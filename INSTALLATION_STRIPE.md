# 🔧 Instalación y Setup - Stripe Mobile

## 📋 Pre-requisitos

- Flutter 3.10+ instalado
- Dart 3.10+ instalado
- Proyecto Flutter con Supabase ya configurado
- Claves de Stripe (test o producción)

## 🚀 Instalación Paso a Paso

### Paso 1: Actualizar pubspec.yaml

El archivo ya ha sido actualizado con:
```yaml
dependencies:
  flutter_stripe: ^10.4.0
  http: ^1.2.0
```

Si por alguna razón necesitas hacerlo manualmente:

```bash
cd kickspremium_mobile
flutter pub add flutter_stripe:^10.4.0
flutter pub add http:^1.2.0
```

### Paso 2: Descargar dependencias

```bash
flutter pub get
```

O si falla:

```bash
flutter pub cache clean
flutter pub get
```

### Paso 3: Configurar Stripe en main.dart

En `lib/main.dart`, asegúrate de que Stripe se inicializa:

```dart
import 'package:flutter_stripe/flutter_stripe.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Inicializar dotenv
  await dotenv.load(fileName: 'assets/env');
  
  // Inicializar Stripe
  Stripe.publishableKey = dotenv.env['PUBLIC_STRIPE_PUBLIC_KEY'] ?? '';
  await Stripe.instance.applySettings();
  
  // Resto de inicialización...
  runApp(const MyApp());
}
```

### Paso 4: Configurar iOS (si aplica)

1. Abre `ios/Podfile`
2. Descomenta la línea de plataforma si está comentada:
```ruby
platform :ios, '14.0'
```

3. Ejecuta:
```bash
cd ios
pod repo update
pod install
cd ..
```

### Paso 5: Configurar Android (si aplica)

1. Abre `android/build.gradle`
2. Verifica que `minSdkVersion` sea al menos 21:
```gradle
minSdkVersion = 21
```

### Paso 6: Variables de Entorno

Asegúrate de que tu archivo `.env` (o `assets/env`) tenga:

```env
PUBLIC_STRIPE_PUBLIC_KEY=pk_test_51SLLkULJDIZy9upCBjdyv9JVBHGkfPar9msGEWIhYtaqzTStAjGx4yT0BG56tgvMH9vpiV8jNsJc3r2xIGWWd56O00e1C6AyX7
```

> ⚠️ **IMPORTANTE**: Usa la clave de TEST mientras desarrollas. Para producción, cambia a la clave LIVE.

### Paso 7: Verificar Instalación

```bash
# Limpia compilación anterior
flutter clean

# Descarga todo nuevamente
flutter pub get

# Intenta compilar
flutter pub get && flutter analyze

# Si todo está bien
flutter run
```

## 🔍 Verificar que Stripe está correctamente integrado

En Flutter, ejecuta este test:

```dart
import 'package:flutter_stripe/flutter_stripe.dart';

// En algún lugar del código (ej: en main o un test)
void testStripeInit() {
  print('Stripe Publishable Key: ${Stripe.publishableKey}');
  print('Stripe ready: ${Stripe.publishableKey.isNotEmpty}');
}
```

## 🐛 Troubleshooting

### Error: "flutter_stripe not found"
**Solución:**
```bash
flutter pub cache clean
flutter pub get
```

### Error: "Stripe.publishableKey is empty"
**Solución:**
- Verifica que `PUBLIC_STRIPE_PUBLIC_KEY` está en `.env`
- Verifica que el archivo `.env` está en `assets/env`
- Verifica que `flutter_dotenv` está cargando el archivo

### Error: "Compilation failed" en iOS
**Solución:**
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

### Error: "Compilation failed" en Android
**Solución:**
```bash
./gradlew clean
flutter clean
flutter pub get
```

## 📱 Compilar para cada plataforma

### Android

```bash
# En debug (para testing)
flutter run

# En release
flutter build apk
flutter install
```

### iOS

```bash
# En debug
flutter run

# En release
flutter build ios
```

### Web (no soportado Stripe Payment Sheet)
```bash
# Si necesitas web, usa Stripe Elements en lugar de Payment Sheet
# Por ahora, omite la web en flutter_stripe
```

## ✅ Verificación Final

Una vez instalado, verifica que:

- [ ] `pubspec.yaml` tiene `flutter_stripe: ^10.4.0`
- [ ] `pubspec.yaml` tiene `http: ^1.2.0`
- [ ] `flutter pub get` ejecutó sin errores
- [ ] El proyecto compila sin errores
- [ ] Las rutas incluyen `/checkout`
- [ ] El provider `userEmailProvider` existe
- [ ] `StripeService` se inicializa en `main.dart`

## 🚀 Próximo Paso

Después de instalar:
1. Lee [TESTING_STRIPE_MOBILE.md](./TESTING_STRIPE_MOBILE.md)
2. Configura el webhook en Stripe Dashboard ([WEBHOOK_SETUP.md](./WEBHOOK_SETUP.md))
3. ¡Prueba un pago!

## 📚 Recursos

- [Documentación de flutter_stripe](https://pub.dev/packages/flutter_stripe)
- [Documentación de Stripe](https://stripe.com/docs)
- [Ejemplos de flutter_stripe](https://github.com/flutter-stripe/flutter_stripe)

---

**¡Instalación completada! 🎉**

Si tienes problemas, revisa los logs con:
```bash
flutter logs
```
