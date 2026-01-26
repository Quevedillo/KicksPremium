import nodemailer from 'nodemailer';

// Script para probar el envío de email via SMTP de Gmail
const smtpConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'joseluisgq17@gmail.com',
    pass: 'xsss hiof lbpi qavp', // Contraseña de aplicación de Gmail
  },
};

async function testSMTP() {
  try {
    console.log('🧪 Probando conexión SMTP con Gmail...');
    console.log('Host:', smtpConfig.host);
    console.log('Puerto:', smtpConfig.port);
    console.log('Usuario:', smtpConfig.auth.user);
    
    // Crear transporter
    const transporter = nodemailer.createTransport(smtpConfig);
    
    // Verificar conexión
    console.log('\n📡 Verificando conexión...');
    await transporter.verify();
    console.log('✅ Conexión SMTP verificada correctamente!\n');
    
    // Enviar email de prueba
    console.log('📨 Enviando email de prueba...');
    const result = await transporter.sendMail({
      from: '"Kicks Premium" <joseluisqg17@gmail.com>',
      to: 'joseluisgq17@gmail.com', // Tu otro email para recibir la prueba
      subject: '🧪 Test - Email SMTP Funcionando',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #000;">¡Prueba Exitosa!</h1>
          <p>Si recibes este email, tu configuración SMTP está funcionando correctamente.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Servidor:</strong> ${smtpConfig.host}:${smtpConfig.port}</p>
          <hr style="border: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Este email fue enviado desde Kicks Premium usando Gmail SMTP.</p>
        </div>
      `,
    });

    console.log('\n✅ Email enviado correctamente!');
    console.log('Message ID:', result.messageId);
    console.log('Response:', result.response);
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'EAUTH') {
      console.error('\n💡 Sugerencia: Verifica que la contraseña de aplicación sea correcta.');
      console.error('   Puedes crear una nueva en: https://myaccount.google.com/apppasswords');
    }
    process.exit(1);
  }
}

testSMTP();
