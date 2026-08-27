<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/tickets.php';

$action = $_REQUEST['action'] ?? '';

// Require authentication for all support ticket actions
$user = getCurrentUser();
if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Authentication required. Please sign in to access support tickets.']);
    exit;
}

// 1. Create a New Support Ticket
if ($action === 'create') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $subject = $input['subject'] ?? '';
    $category = $input['category'] ?? 'General';
    $priority = $input['priority'] ?? 'Medium';
    $message = $input['message'] ?? '';
    
    if (empty($subject) || empty($message)) {
        echo json_encode(['success' => false, 'message' => 'Subject and message description are required.']);
        exit;
    }
    
    $res = createNewTicket($user['id'], $subject, $category, $priority, $message);
    echo json_encode($res);
    exit;
}

// 2. List User Tickets
if ($action === 'list') {
    $tickets = getUserTicketsList($user['id']);
    echo json_encode([
        'success' => true,
        'tickets' => $tickets
    ]);
    exit;
}

// 3. Get Single Ticket Conversation Thread
if ($action === 'detail') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_GET;
    $ticketId = $input['ticket_id'] ?? $input['id'] ?? '';
    
    if (empty($ticketId)) {
        echo json_encode(['success' => false, 'message' => 'Ticket ID is required.']);
        exit;
    }
    
    $ticket = getTicketDetailsWithThread($ticketId, $user['id']);
    if (!$ticket) {
        echo json_encode(['success' => false, 'message' => 'Support ticket not found or access denied.']);
        exit;
    }
    
    echo json_encode([
        'success' => true,
        'ticket' => $ticket
    ]);
    exit;
}

// 4. Post Reply to Ticket Thread
if ($action === 'reply') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $ticketId = $input['ticket_id'] ?? '';
    $message = $input['message'] ?? '';
    
    if (empty($ticketId) || empty(trim($message))) {
        echo json_encode(['success' => false, 'message' => 'Ticket ID and reply message are required.']);
        exit;
    }
    
    // Check ownership
    $ticket = getTicketDetailsWithThread($ticketId, $user['id']);
    if (!$ticket) {
        echo json_encode(['success' => false, 'message' => 'Ticket not found or access denied.']);
        exit;
    }
    
    $res = addReplyToTicket($ticket['id'], $user['id'], $message, 0);
    if ($res['success']) {
        // Return updated ticket thread
        $updatedTicket = getTicketDetailsWithThread($ticket['id'], $user['id']);
        $res['ticket'] = $updatedTicket;
    }
    echo json_encode($res);
    exit;
}

// 5. Close / Resolve Ticket
if ($action === 'close') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $ticketId = $input['ticket_id'] ?? '';
    
    if (empty($ticketId)) {
        echo json_encode(['success' => false, 'message' => 'Ticket ID is required.']);
        exit;
    }
    
    $res = updateTicketStatus($ticketId, $user['id'], 'Closed');
    echo json_encode($res);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid ticket action requested.']);
?>
