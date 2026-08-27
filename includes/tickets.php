<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/db.php';

/**
 * Create a new support ticket with an initial message
 */
function createNewTicket($userId, $subject, $category = 'General', $priority = 'Medium', $initialMessage = '') {
    $db = getDBConnection();
    
    $ticketCode = 'TKT-' . date('Y') . '-' . sprintf('%05d', rand(1000, 99999));
    
    $db->beginTransaction();
    try {
        // 1. Insert Ticket Header
        $stmt = $db->prepare("INSERT INTO tickets (ticket_code, user_id, subject, category, priority, status) 
                              VALUES (:code, :uid, :subj, :cat, :prio, 'Open')");
        $stmt->execute([
            ':code' => $ticketCode,
            ':uid' => $userId,
            ':subj' => trim($subject),
            ':cat' => $category,
            ':prio' => $priority
        ]);
        
        $ticketId = $db->lastInsertId();
        
        // 2. Insert Initial Message in Replies Table
        if (!empty($initialMessage)) {
            $stmt = $db->prepare("INSERT INTO ticket_replies (ticket_id, user_id, is_staff, message) 
                                  VALUES (:tid, :uid, 0, :msg)");
            $stmt->execute([
                ':tid' => $ticketId,
                ':uid' => $userId,
                ':msg' => trim($initialMessage)
            ]);
        }
        
        $db->commit();
        
        return [
            'success' => true,
            'ticket_id' => $ticketId,
            'ticket_code' => $ticketCode,
            'message' => 'Support ticket created successfully!'
        ];
    } catch (Exception $e) {
        $db->rollBack();
        return [
            'success' => false,
            'message' => 'Failed to create support ticket: ' . $e->getMessage()
        ];
    }
}

/**
 * Get list of tickets for a specific user (or all tickets if user is an admin)
 */
function getUserTicketsList($userId) {
    $db = getDBConnection();
    require_once __DIR__ . '/admin.php';

    if (isAdmin()) {
        $stmt = $db->query("
            SELECT t.*, u.name as customer_name, u.email as customer_email,
                   (SELECT COUNT(*) FROM ticket_replies tr WHERE tr.ticket_id = t.id) as reply_count
            FROM tickets t 
            JOIN users u ON t.user_id = u.id
            ORDER BY t.updated_at DESC
        ");
        return $stmt->fetchAll();
    } else {
        $stmt = $db->prepare("
            SELECT t.*, 
                   (SELECT COUNT(*) FROM ticket_replies tr WHERE tr.ticket_id = t.id) as reply_count
            FROM tickets t 
            WHERE t.user_id = :uid 
            ORDER BY t.updated_at DESC
        ");
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll();
    }
}

/**
 * Get single ticket details and complete conversation thread
 */
function getTicketDetailsWithThread($ticketCodeOrId, $userId = null) {
    $db = getDBConnection();
    
    $sql = "SELECT t.*, u.name as user_name, u.email as user_email, u.avatar_url as user_avatar 
            FROM tickets t 
            JOIN users u ON t.user_id = u.id 
            WHERE (t.ticket_code = :id OR t.id = :id)";
    $params = [':id' => $ticketCodeOrId];
    
    require_once __DIR__ . '/admin.php';
    if ($userId !== null && !isAdmin()) {
        $sql .= " AND t.user_id = :uid";
        $params[':uid'] = $userId;
    }
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $ticket = $stmt->fetch();
    
    if (!$ticket) return null;
    
    // Fetch all replies in order
    $stmtReplies = $db->prepare("
        SELECT tr.*, u.name as author_name, u.email as author_email, u.avatar_url as author_avatar 
        FROM ticket_replies tr 
        JOIN users u ON tr.user_id = u.id 
        WHERE tr.ticket_id = :tid 
        ORDER BY tr.created_at ASC
    ");
    $stmtReplies->execute([':tid' => $ticket['id']]);
    $ticket['replies'] = $stmtReplies->fetchAll();
    
    return $ticket;
}

/**
 * Add a reply to a support ticket thread
 */
function addReplyToTicket($ticketId, $userId, $message, $isStaff = 0) {
    $db = getDBConnection();
    
    if (empty(trim($message))) {
        return ['success' => false, 'message' => 'Reply message cannot be empty.'];
    }
    
    $db->beginTransaction();
    try {
        // 1. Insert Reply
        $stmt = $db->prepare("INSERT INTO ticket_replies (ticket_id, user_id, is_staff, message) 
                              VALUES (:tid, :uid, :staff, :msg)");
        $stmt->execute([
            ':tid' => $ticketId,
            ':uid' => $userId,
            ':staff' => $isStaff,
            ':msg' => trim($message)
        ]);
        
        // 2. Update Ticket Timestamp & Status
        $newStatus = ($isStaff == 1) ? 'In Progress' : 'Open';
        $stmtUpdate = $db->prepare("UPDATE tickets SET updated_at = CURRENT_TIMESTAMP, status = :st WHERE id = :tid");
        $stmtUpdate->execute([':st' => $newStatus, ':tid' => $ticketId]);
        
        $db->commit();
        
        return ['success' => true, 'message' => 'Reply posted successfully!'];
    } catch (Exception $e) {
        $db->rollBack();
        return ['success' => false, 'message' => 'Failed to post reply: ' . $e->getMessage()];
    }
}

/**
 * Update ticket status (e.g., Close/Resolve)
 */
function updateTicketStatus($ticketId, $userId, $status) {
    $db = getDBConnection();
    $allowedStatuses = ['Open', 'In Progress', 'Resolved', 'Closed'];
    
    if (!in_array($status, $allowedStatuses)) {
        return ['success' => false, 'message' => 'Invalid status option.'];
    }
    
    $stmt = $db->prepare("UPDATE tickets SET status = :st, updated_at = CURRENT_TIMESTAMP WHERE id = :tid AND user_id = :uid");
    $stmt->execute([':st' => $status, ':tid' => $ticketId, ':uid' => $userId]);
    
    return ['success' => true, 'message' => "Ticket status updated to $status!"];
}
?>
