<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

/**
 * Record a payment, update user subscription plan, and generate invoice.
 */
function recordPayment($userId, $plan, $billingCycle = 'monthly', $amount = 0.0, $gateway = 'paypal', $txnId = null) {
    $db = getDBConnection();
    
    // Generate transaction ID if not provided
    if (empty($txnId)) {
        $prefix = strtoupper(substr($gateway, 0, 3));
        $txnId = $prefix . '_' . strtoupper(bin2hex(random_bytes(8)));
    }
    
    // Generate sequential or timestamp-based invoice number
    $invoiceNum = 'INV-' . date('Y') . '-' . sprintf('%05d', rand(1000, 99999));
    
    // Calculate period end
    $days = ($billingCycle === 'yearly') ? 365 : 30;
    $periodEnd = date('Y-m-d H:i:s', strtotime("+$days days"));
    
    $db->beginTransaction();
    try {
        // 1. Insert Transaction
        $stmt = $db->prepare("INSERT INTO transactions 
            (user_id, transaction_id, invoice_number, plan, billing_cycle, amount, currency, gateway, status) 
            VALUES (:uid, :txnid, :inv, :plan, :cycle, :amount, :curr, :gw, 'completed')");
        $stmt->execute([
            ':uid' => $userId,
            ':txnid' => $txnId,
            ':inv' => $invoiceNum,
            ':plan' => $plan,
            ':cycle' => $billingCycle,
            ':amount' => $amount,
            ':curr' => CURRENCY_CODE,
            ':gw' => $gateway
        ]);
        
        // 2. Update User Plan
        updateUserPlan($userId, $plan, $billingCycle);
        
        // 3. Upsert Subscription Table
        $stmt = $db->prepare("INSERT INTO subscriptions 
            (user_id, plan, billing_cycle, status, current_period_end) 
            VALUES (:uid, :plan, :cycle, 'active', :pend)");
        $stmt->execute([
            ':uid' => $userId,
            ':plan' => $plan,
            ':cycle' => $billingCycle,
            ':pend' => $periodEnd
        ]);
        
        $db->commit();
        
        return [
            'success' => true,
            'transaction_id' => $txnId,
            'invoice_number' => $invoiceNum,
            'plan' => $plan,
            'billing_cycle' => $billingCycle,
            'amount' => $amount,
            'period_end' => $periodEnd
        ];
    } catch (Exception $e) {
        $db->rollBack();
        return [
            'success' => false,
            'message' => 'Failed to record payment: ' . $e->getMessage()
        ];
    }
}

/**
 * Get all transactions for a user
 */
function getUserTransactions($userId) {
    $db = getDBConnection();
    $stmt = $db->prepare("SELECT * FROM transactions WHERE user_id = :uid ORDER BY created_at DESC");
    $stmt->execute([':uid' => $userId]);
    return $stmt->fetchAll();
}

/**
 * Get single transaction by ID or Invoice Number
 */
function getTransactionDetail($invoiceOrTxnId, $userId = null) {
    $db = getDBConnection();
    $sql = "SELECT t.*, u.name as user_name, u.email as user_email 
            FROM transactions t 
            JOIN users u ON t.user_id = u.id 
            WHERE (t.invoice_number = :id OR t.transaction_id = :id)";
    $params = [':id' => $invoiceOrTxnId];
    
    if ($userId !== null) {
        $sql .= " AND t.user_id = :uid";
        $params[':uid'] = $userId;
    }
    
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetch() ?: null;
}

/**
 * Render printable HTML invoice receipt for transaction
 */
function renderInvoiceHTML($txn) {
    if (!$txn) return '<h2>Invoice Not Found</h2>';
    
    $planName = ucfirst($txn['plan']);
    $cycleName = ucfirst($txn['billing_cycle']);
    $amountFormatted = CURRENCY_SYMBOL . number_format($txn['amount'], 2) . ' ' . $txn['currency'];
    $dateFormatted = date('F j, Y g:i A', strtotime($txn['created_at']));
    
    return '
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Invoice ' . htmlspecialchars($txn['invoice_number']) . ' - Sargpoint GIS</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 40px 20px; }
            .invoice-box { max-width: 750px; margin: auto; padding: 35px; border: 1px solid #e2e8f0; background: #ffffff; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .header-table td { vertical-align: top; }
            .logo-title { font-size: 24px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px; }
            .invoice-num { font-size: 20px; font-weight: 700; color: #475569; text-align: right; }
            .invoice-status { display: inline-block; background: #dcfce7; color: #166534; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; margin-top: 5px; text-transform: uppercase; }
            .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; padding: 15px 0; font-size: 14px; }
            .info-block div { margin-bottom: 4px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th { background: #f1f5f9; color: #475569; text-align: left; padding: 12px 15px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
            .items-table td { padding: 15px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
            .total-row td { font-weight: 700; font-size: 16px; border-bottom: none; }
            .footer-note { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 40px; }
            @media print { .no-print { display: none; } body { padding: 0; background: #fff; } .invoice-box { border: none; box-shadow: none; } }
        </style>
    </head>
    <body>
        <div class="no-print" style="max-width:750px; margin:0 auto 15px auto; text-align:right;">
            <button onclick="window.print()" style="background:#2563eb; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:600; cursor:pointer;">Print / Save PDF</button>
        </div>
        <div class="invoice-box">
            <table class="header-table">
                <tr>
                    <td>
                        <div class="logo-title">Sargpoint GIS Converter</div>
                        <div style="font-size:13px; color:#64748b; margin-top:4px;">Spatial & GIS Coordinate SaaS System</div>
                    </td>
                    <td style="text-align:right;">
                        <div class="invoice-num">' . htmlspecialchars($txn['invoice_number']) . '</div>
                        <div class="invoice-status">' . htmlspecialchars($txn['status']) . '</div>
                    </td>
                </tr>
            </table>

            <div class="info-grid">
                <div class="info-block">
                    <strong style="color:#64748b; font-size:12px; text-transform:uppercase;">Billed To:</strong>
                    <div style="font-weight:700; margin-top:4px;">' . htmlspecialchars($txn['user_name']) . '</div>
                    <div>' . htmlspecialchars($txn['user_email']) . '</div>
                </div>
                <div class="info-block" style="text-align:right;">
                    <strong style="color:#64748b; font-size:12px; text-transform:uppercase;">Payment Details:</strong>
                    <div style="margin-top:4px;">Date: <strong>' . $dateFormatted . '</strong></div>
                    <div>Gateway: <strong>' . strtoupper(htmlspecialchars($txn['gateway'])) . '</strong></div>
                    <div>Transaction ID: <span style="font-family:monospace; font-size:12px;">' . htmlspecialchars($txn['transaction_id']) . '</span></div>
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Billing Cycle</th>
                        <th style="text-align:right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <strong>Sargpoint GIS ' . $planName . ' Subscription</strong>
                            <div style="font-size:12px; color:#64748b;">Full spatial format conversions, CRS projections, and API access</div>
                        </td>
                        <td>' . $cycleName . '</td>
                        <td style="text-align:right; font-weight:600;">' . $amountFormatted . '</td>
                    </tr>
                    <tr class="total-row">
                        <td colspan="2" style="text-align:right; padding-right:20px;">Total Paid:</td>
                        <td style="text-align:right; color:#2563eb;">' . $amountFormatted . '</td>
                    </tr>
                </tbody>
            </table>

            <div class="footer-note">
                Thank you for subscribing to Sargpoint GIS Converter.<br>
                For billing support or inquiries, please contact support@sargpoint.com
            </div>
        </div>
    </body>
    </html>
    ';
}
?>
