import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class StripeService {
  static final String publicKey = dotenv.env['PUBLIC_STRIPE_PUBLIC_KEY'] ?? '';
  // Cambia esto según tu ambiente (localhost para desarrollo, producción para la web)
  static const String _backendUrl = 'http://localhost:3000'; 

  static void init() {
    Stripe.publishableKey = publicKey;
    Stripe.instance.applySettings();
  }

  /// Crea un Payment Intent en el backend
  static Future<Map<String, dynamic>> createPaymentIntent({
    required int amount,
    required String currency,
    required String orderId,
    Map<String, String>? metadata,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$_backendUrl/api/stripe/create-payment-intent'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'amount': amount,
          'currency': currency,
          'orderId': orderId,
          'metadata': metadata ?? {},
        }),
      ).timeout(
        const Duration(seconds: 30),
        onTimeout: () => throw Exception('Timeout al conectar con el servidor'),
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      } else {
        final error = jsonDecode(response.body)['error'] ?? 'Error desconocido';
        throw Exception('Error creando payment intent: $error');
      }
    } on http.ClientException catch (e) {
      throw Exception('Error de conexión: ${e.message}');
    } catch (e) {
      rethrow;
    }
  }

  /// Procesa el pago con Stripe
  static Future<bool> processPayment({
    required String clientSecret,
    required String returnUrl,
  }) async {
    try {
      await Stripe.instance.confirmPaymentSheetPayment();
      return true;
    } catch (e) {
      throw Exception('Error al procesar pago: $e');
    }
  }

  /// Inicializa el Payment Sheet
  static Future<void> initializePaymentSheet({
    required String clientSecret,
    required String customerEmail,
    required String merchantDisplayName,
  }) async {
    try {
      await Stripe.instance.initPaymentSheet(
        paymentSheetParameters: SetupPaymentSheetParameters(
          paymentIntentClientSecret: clientSecret,
          customerEphemeralKeySecret: null,
          customerId: null,
          merchantDisplayName: merchantDisplayName,
          defaultBillingDetails: BillingDetails(
            email: customerEmail,
          ),
          appearance: PaymentSheetAppearance(
            colors: PaymentSheetAppearanceColors(
              primary: const Color(0xFFFF1744),
              background: const Color(0xFF1C1C1C),
              componentBackground: const Color(0xFF2A2A2A),
              componentBorder: const Color(0xFF404040),
              componentText: const Color(0xFFFFFFFF),
              secondaryText: const Color(0xFF999999),
              placeholderText: const Color(0xFF666666),
            ),
            shapes: PaymentSheetShape(
              borderRadius: 12,
              shadowColor: const Color(0xFF000000),
            ),
            primaryButtonAppearance: PaymentSheetPrimaryButtonAppearance(
              colors: PrimaryButtonColors(
                background: const Color(0xFFFF1744),
                text: const Color(0xFFFFFFFF),
              ),
              shapes: PrimaryButtonShape(
                borderRadius: 8,
                elevation: 2,
              ),
            ),
          ),
        ),
      );
    } catch (e) {
      throw Exception('Error inicializando payment sheet: $e');
    }
  }

  /// Confirma el pago con el PaymentSheet
  static Future<bool> confirmPayment() async {
    try {
      await Stripe.instance.confirmPaymentSheetPayment();
      return true;
    } catch (e) {
      if (e is StripeException) {
        throw Exception('Pago cancelado: ${e.error.localizedMessage}');
      }
      throw Exception('Error confirming payment: $e');
    }
  }

  /// Procesa el reembolso (para el admin)
  static Future<bool> refundPayment({
    required String paymentIntentId,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$_backendUrl/api/stripe/refund'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'paymentIntentId': paymentIntentId,
        }),
      );

      if (response.statusCode == 200) {
        return true;
      } else {
        throw Exception('Error reembolsando: ${response.body}');
      }
    } catch (e) {
      rethrow;
    }
  }
}
