import type { APIRoute } from 'astro';
import { getSupabaseServiceClient } from '@lib/supabase';
import { sendOrderConfirmationEmail, sendAdminOrderNotification } from '@lib/email';
import { enrichOrderItems } from '@lib/utils';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      sessionId,
      userId,
      cartItems,
      totalAmount,
      shippingAddress,
      shippingName,
      shippingPhone,
      billingEmail,
    } = body;

    console.log(`\n===== PROCESSING CHECKOUT SUCCESS =====`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`User ID: ${userId}`);
    console.log(`Total Amount: ${totalAmount} cents (€${(totalAmount / 100).toFixed(2)})`);
    console.log(`Cart Items: ${cartItems.length}`);

    // Use service client to bypass RLS
    const supabase = getSupabaseServiceClient();

    // Check if order already exists
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('stripe_session_id', sessionId)
      .single();

    if (existingOrder) {
      console.log(`Order already exists for session ${sessionId}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Order already processed' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Enrich cart items from DB (Stripe metadata uses compact format {id, n, p, q, s})
    // This fetches full product name, brand, and image for each item
    const enrichedItems = await enrichOrderItems(supabase, cartItems);
    console.log(`✅ Items enriched: ${enrichedItems.map(i => i.name).join(', ')}`);

    // Create order in Supabase with enriched items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        stripe_session_id: sessionId,
        total_amount: totalAmount,
        status: 'paid',
        shipping_name: shippingName,
        shipping_address: shippingAddress ? JSON.stringify(shippingAddress) : null,
        shipping_phone: shippingPhone,
        billing_email: billingEmail,
        items: enrichedItems,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) {
      console.error(`Error saving order:`, orderError);
      console.error(`Order error details:`, JSON.stringify(orderError, null, 2));
      return new Response(
        JSON.stringify({ error: `Error saving order: ${orderError.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Order created: ${order.id}`);

    // Decrement stock for each item
    console.log(`\n📦 Starting stock decrement for ${enrichedItems.length} items...`);
    let stockErrors = [];

    for (const item of enrichedItems) {
      try {
        const productId = item.id;
        const quantity = item.qty || 1;
        const size = item.size;

        console.log(`  Processing: ${item.name} (ID: ${productId}, Qty: ${quantity}, Size: ${size})`);

        // Get current product
        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('stock, sizes_available')
          .eq('id', productId)
          .single();

        if (fetchError || !product) {
          console.error(`    ❌ Could not fetch product ${productId}`);
          stockErrors.push(`Could not update stock for ${item.name}`);
          continue;
        }

        // Decrement stock for specific size
        let newSizesAvailable = { ...(product.sizes_available || {}) };
        let newTotalStock = product.stock || 0;

        if (size && newSizesAvailable[size]) {
          const oldQty = parseInt(newSizesAvailable[size]) || 0;
          newSizesAvailable[size] = Math.max(0, oldQty - quantity);
          newTotalStock = Math.max(0, newTotalStock - quantity);

          console.log(`    Size ${size}: ${oldQty} → ${newSizesAvailable[size]}`);
        }

        // Update product
        const { error: updateError } = await supabase
          .from('products')
          .update({
            stock: newTotalStock,
            sizes_available: newSizesAvailable,
          })
          .eq('id', productId);

        if (updateError) {
          console.error(`    ❌ Error updating stock:`, updateError);
          stockErrors.push(`Could not update stock for ${item.name}`);
        } else {
          console.log(`    ✅ Stock updated: ${newTotalStock} total`);
        }
      } catch (err) {
        console.error(`    ❌ Error processing item:`, err);
        stockErrors.push(`Error processing ${item.name}`);
      }
    }

    // Send emails
    console.log(`\n📧 Sending emails...`);
    // Transform enriched items to match OrderItem interface
    const orderItems = enrichedItems.map((item: any) => ({
      id: item.id || '',
      name: item.name,
      price: item.price || 0,
      quantity: item.qty || item.quantity || 1,
      image: item.img || '',
      size: item.size,
    }));

    const subtotal = orderItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    const tax = totalAmount - subtotal;

    try {
      // Send order confirmation email
      await sendOrderConfirmationEmail({
        orderId: order.id,
        email: billingEmail,
        customerName: shippingName || 'Customer',
        items: orderItems,
        subtotal,
        tax: Math.max(0, tax),
        total: totalAmount,
        shippingAddress: shippingAddress,
        stripeSessionId: sessionId,
      });
      console.log(`✅ Order confirmation email sent to ${billingEmail}`);
    } catch (emailError) {
      console.error(`❌ Error sending order confirmation email:`, emailError);
    }

    try {
      // Send admin notification
      await sendAdminOrderNotification({
        orderId: order.id,
        email: billingEmail,
        customerName: shippingName || 'Customer',
        items: orderItems,
        subtotal,
        tax: Math.max(0, tax),
        total: totalAmount,
        shippingAddress: shippingAddress,
        stripeSessionId: sessionId,
      });
      console.log(`✅ Admin notification sent`);
    } catch (emailError) {
      console.error(`❌ Error sending admin notification:`, emailError);
    }

    console.log(`\n===== CHECKOUT PROCESSING COMPLETE =====\n`);

    return new Response(
      JSON.stringify({
        success: true,
        orderId: order.id,
        stockErrors: stockErrors.length > 0 ? stockErrors : undefined,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing checkout success:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
