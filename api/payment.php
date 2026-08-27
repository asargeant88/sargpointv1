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

// Ensure user is authenticated for API actions below
$user = getCurrentUser();
if (!$user) {
    echo json_encode(['success' => false, 'message' => 'Authentication required. Please sign in first.']);
    exit;
}

// 3. Create Stripe Checkout Session / Order Specs
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
    
    // If real Stripe Secret Key is configured, attempt Stripe API Checkout Session creation via cURL
    $stripeSessionId = null;
    $stripeCheckoutUrl = null;
    
    if (defined('STRIPE_SECRET_KEY') && strpos(STRIPE_SECRET_KEY, 'sk_live_') === 0) {
        $ch = curl_init('https://api.stripe.com/v1/checkout/sessions');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_USERPWD, STRIPE_SECRET_KEY . ':');
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'payment_method_types' => ['card'],
            'client_reference_id' => $user['id'],
            'line_items' => [[
                'price_data' => [
                    'currency' => 'usd',
                    'product_data' => [
                        'name' => 'Sargpoint GIS ' . ucfirst($plan) . ' Plan (' . ucfirst($cycle) . ')',
                        'description' => 'Spatial format conversions, CRS projections, and API access'
                    ],
                    'unit_amount' => intval($totalAmount * 100)
                ],
                'quantity' => 1
            ]],
            'mode' => 'payment',
            'success_url' => 'http://' . $_SERVER['HTTP_HOST'] . '/?payment=success&session_id={CHECKOUT_SESSION_ID}',
            'cancel_url' => 'http://' . $_SERVER['HTTP_HOST'] . '/?payment=cancel',
            'metadata' => [
                'user_id' => $user['id'],
                'plan' => $plan,
                'billing_cycle' => $cycle
            ]
        ]));
        $response = curl_exec($ch);
        curl_close($ch);
        
        $sessionData = json_decode($response, true);
        if (isset($sessionData['id'])) {
            $stripeSessionId = $sessionData['id'];
            $stripeCheckoutUrl = $sessionData['url'];
        }
    }
    
    echo json_encode([
        'success' => true,
        'stripe_publishable_key' => STRIPE_PUBLISHABLE_KEY,
        'stripe_session_id' => $stripeSessionId,
        'stripe_checkout_url' => $stripeCheckoutUrl,
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
