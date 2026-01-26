import { Resend } from 'resend';

// Script para probar la API de Resend
const apiKey = 're_e6deJgMZ_L3LWyTTDzbb2Nzdpj219Sc1D';
const resend = new Resend(apiKey);

async function testResend() {
  try {
    console.log('🧪 Probando conexión con Resend...');
    console.log('API Key:', apiKey.substring(0, 10) + '...');
    
    // IMPORTANTE: En modo testing de Resend, solo puedes enviar a tu email verificado
    const result = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'joseluisgq17@gmail.com', // Tu email verificado en Resend
      subject: '🧪 Test - Tu Newsletter Funciona',
      html: `
        <h1>¡Prueba Exitosa!</h1>
        <p>Si recibes este email, tu newsletter está funcionando correctamente.</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
        <p><strong>Nota:</strong> Tu cuenta Resend está en modo testing. Solo puede enviar a joseluisgq17@gmail.com</p>
      `,
    });

    console.log('\n📨 Respuesta de Resend:');
    console.log(JSON.stringify(result, null, 2));

    if (result.error) {
      console.error('\n❌ ERROR:', result.error);
      process.exit(1);
    } else {
      console.log('\n✅ Email enviado correctamente!');
      console.log('ID:', result.data?.id);
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Error al enviar:', error);
    process.exit(1);
  }
}

testResend();
