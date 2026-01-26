import 'package:flutter/foundation.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';

class StripeService {
  static String get publicKey => dotenv.env['PUBLIC_STRIPE_PUBLIC_KEY'] ?? '';
  static String get _backendUrl => dotenv.env['BACKEND_URL'] ?? 'http://localhost:3000';

  static Future<void> init() async {
    final key = publicKey;
    if (key.isEmpty) {
      debugPrint('ERROR: PUBLIC_STRIPE_PUBLIC_KEY no está en .env');
      return;
    }
    
    try {
      Stripe.publishableKey = key;
      Stripe.instance.applySettings();
      debugPrint('✅ Stripe inicializado');
    } catch (e) {
      debugPrint('❌ Error inicializando Stripe: $e');
      rethrow;
    }
  }

  static Future<Map<String, dynamic>> createPaymentIntent({
    required int amount,
    required String currency,
    required String orderId,
    Map<String, String>? metadata,
  }) async {
    if (amount <= 0) throw Exception('Monto debe ser mayor a 0');
    if (orderId.isEmpty) throw Exception('orderId vacío');

    final url = Uri.parse('$_backendUrl/api/stripe/create-payment-intent');
    
    try {
      final response = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'amount': amount,
              'currency': currency,
              'orderId': orderId,
              'metadata': metadata ?? {},
            }),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        if (data.containsKey('clientSecret')) {
          return data;
        }
        throw Exception('clientSecret no recibido');
      }

      throw Exception('HTTP ${response.statusCode}: ${response.body}');
    } on TimeoutException {
      throw Exception('Timeout: servidor no responde');
    } on FormatException catch (e) {
      throw Exception('JSON inválido: $e');
    } on http.ClientException catch (e) {
      throw Exception('Error conexión: $e');
    }
  }

  static Future<void> initPaymentSheet({
    required String clientSecret,
    required String email,
    String merchantName = 'KicksPremium',
  }) async {
    if (clientSecret.isEmpty) throw Exception('clientSecret vacío');

    try {
      final params = SetupPaymentSheetParameters(
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: merchantName,
        billingDetails: BillingDetails(email: email),
      );
      
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: params,
      );
    } catch (e) {
      debugPrint('Error initPaymentSheet: $e');
      throw Exception('Error inicializando pago: $e');
    }
  }

  static Future<bool> presentPaymentSheet() async {
    try {
      await Stripe.instance.presentPaymentSheet();
      return true;
    } catch (e) {
      final msg = e.toString().toLowerCase();
      
      if (msg.contains('cancel')) {
        throw Exception('Pago cancelado');
      }
      
      debugPrint('Error presentPaymentSheet: $e');
      throw Exception('Error procesando pago: $e');
    }
  }

  static Future<bool> refundPayment({required String paymentIntentId}) async {
    if (paymentIntentId.isEmpty) throw Exception('paymentIntentId vacío');

    final url = Uri.parse('$_backendUrl/api/stripe/refund');

    try {
      final response = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'paymentIntentId': paymentIntentId}),
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        return true;
      }

      throw Exception('HTTP ${response.statusCode}: ${response.body}');
    } on TimeoutException {
      throw Exception('Timeout en reembolso');
    } on http.ClientException catch (e) {
      throw Exception('Error conexión: $e');
    }
  }
}