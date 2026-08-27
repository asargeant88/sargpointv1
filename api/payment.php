<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/payment.php';
require_once __DIR__ . '/../includes/usage.php';

$action = $_REQUEST['action'] ?? '';

// 1. Stripe Webhook Listener (Unauthenticated public endpoint called by Stripe servers)
if ($action === 'stripe_webhook') {
    $payload = @file_get_contents('php://input');
    $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
    
    $event = json_decode($payload, true);
    if ($event && isset($event['type']) && $event['type'] === 'checkout.session.completed') {
        $session = $event['data']['object'];
        $userId = $session['client_reference_id'] ?? null;
        $plan = $session['metadata']['plan'] ?? 'starter';
        $cycle = $session['metadata']['billing_cycle'] ?? 'monthly';
        $amount = ($session['amount_total'] ?? 0) / 100;
        $paymentIntent = $session['payment_intent'] ?? ('cs_' . bin2hex(random_bytes(8)));
        
        if ($userId) {
            recordPayment($userId, $plan, $cycle, $amount, 'stripe', $paymentIntent);
        }
        echo json_encode(['status' => 'success']);
        exit;
    }
    echo json_encode(['status' => 'ignored']);
    exit;
}

// 2. Handle invoice viewing endpoint (HTML response)
if ($action === 'view_invoice') {
    header('Content-Type: text/html; charset=utf-8');
    $user = getCurrentUser();
    $invId = $_GET['invoice_number'] ?? $_GET['id'] ?? '';
    
    if (empty($invId)) {
        echo '<h2>Invoice ID required.</h2>';
        exit;
    }
    
    $userId = $user ? $user['id'] : null;
    $txn = getTransactionDetail($invId, $userId);
    
    if (!$txn) {
        echo '<h2>Invoice not found or access denied.</h2>';
        exit;
    }
    
    echo renderInvoiceHTML($txn);
    exit;
}

// 2. Create Stripe Checkout Session / Order Specs (Public access for rendering buy buttons)
if ($action === 'create_stripe_session') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_GET;
    $plan = strtolower($input['plan'] ?? 'starter');
    $cycle = strtolower($input['billing_cycle'] ?? 'monthly');
    
    $planConfig = $GLOBALS['PLAN_LIMITS'][$plan] ?? null;
    if (!$planConfig) {
        echo json_encode(['success' => false, 'message' => 'Invalid subscription plan selected.']);
        exit;
    }
    
    $unitPrice = ($cycle === 'yearly') ? $planConfig['yearly_price'] : $planConfig['monthly_price'];
    $totalAmount = ($cycle === 'yearly') ? $unitPrice * 12 : $unitPrice;
    
    $buyButtonId = ($cycle === 'yearly') ? ($planConfig['stripe_buy_btn_yearly'] ?? '') : ($planConfig['stripe_buy_btn_monthly'] ?? '');

    echo json_encode([
        'success' => true,
        'stripe_publishable_key' => STRIPE_PUBLISHABLE_KEY,
        'buy_button_id' => $buyButtonId,
        'plan' => $plan,
        'plan_name' => $planConfig['name'],
        'billing_cycle' => $cycle,
        'unit_price' => $unitPrice,
        'total_amount' => $totalAmount,
        'currency' => CURRENCY_CODE,
        'currency_symbol' => CURRENCY_SYMBOL
    ]);
    exit;
}

// Ensure user is authenticated for user-specific actions below
$user = getCurrentUser();
if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Authentication required. Please sign in first.']);
    exit;
}

// 4. Process Stripe Payment / Card Submission
if ($action === 'process_stripe_payment') {
    $input = json_decode(file_get_contents('php://input'), true) ?? $_POST;
    $plan = strtolower($input['plan'] ?? 'starter');
    $cycle = strtolower($input['billing_cycle'] ?? 'monthly');
    $cardNumber = str_replace(' ', '', $input['card_number'] ?? '');
    
    if (empty($cardNumber) || strlen($cardNumber) < 12) {
        echo json_encode(['success' => false, 'message' => 'Please enter a valid card number.']);
        exit;
    }
    
    $planConfig = $GLOBALS['PLAN_LIMITS'][$plan] ?? null;
    if (!$planConfig) {
        echo json_encode(['success' => false, 'message' => 'Invalid plan.']);
        exit;
    }
    
    $unitPrice = ($cycle === 'yearly') ? $planConfig['yearly_price'] : $planConfig['monthly_price'];
    $totalAmount = ($cycle === 'yearly') ? $unitPrice * 12 : $unitPrice;
    $stripeTxnId = 'ch_stripe_' . strtoupper(bin2hex(random_bytes(8)));
    
    $res = recordPayment($user['id'], $plan, $cycle, $totalAmount, 'stripe', $stripeTxnId);
    if ($res['success']) {
        $updatedUser = getCurrentUser();
        $res['user'] = $updatedUser;
        $res['usage'] = getUserUsageMetrics($updatedUser['id'], $updatedUser['plan']);
        $res['message'] = "Stripe payment processed successfully! Subscribed to " . ucfirst($plan) . " (" . ucfirst($cycle) . ").";
    }
    echo json_encode($res);
    exit;
}

// 5. Get User Transaction History / Invoices
if ($action === 'get_invoices') {
    $transactions = getUserTransactions($user['id']);
    echo json_encode([
        'success' => true,
        'invoices' => $transactions
    ]);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid payment action requested.']);
?>
