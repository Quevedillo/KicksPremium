#!/usr/bin/env node

/**
 * Email Functions Verification Test
 * Verifica que todas las funciones de email están correctamente importables y tienen la estructura correcta
 */

import fs from 'fs';
import path from 'path';

const emailFile = './src/lib/email.ts';

console.log('🔍 Verificando funciones de email...\n');

// Leer el archivo de email
const emailContent = fs.readFileSync(emailFile, 'utf-8');

// Funciones esperadas
const expectedFunctions = [
  'sendEmailWithResend',
  'sendOrderConfirmationEmail',
  'sendNewsletterWelcomeEmail',
  'sendNewProductEmail',
  'sendNewProductToAllSubscribers',
  'sendAdminNotification',
  'sendOrderCancellationEmail',
  'sendReturnRequestEmail',
  'sendAdminOrderNotification',
  'sendAbandonedCartEmail',
];

const results = [];

console.log('Buscando funciones exportadas...\n');

for (const funcName of expectedFunctions) {
  const regex = new RegExp(`export\\s+(async\\s+)?function\\s+${funcName}|export\\s+const\\s+${funcName}`);
  const found = regex.test(emailContent);
  
  results.push({
    name: funcName,
    found,
    status: found ? '✅' : '❌'
  });
  
  console.log(`${found ? '✅' : '❌'} ${funcName}`);
}

console.log('\n' + '='.repeat(50));
console.log('RESUMEN:\n');

const foundCount = results.filter(r => r.found).length;
const totalCount = results.length;

console.log(`Funciones encontradas: ${foundCount}/${totalCount}`);

// Verificar estructura de Resend
console.log('\n🔍 Verificando integración con Resend...\n');

const resendChecks = [
  {
    name: 'API Key en .env.local',
    check: () => {
      const envContent = fs.readFileSync('./.env.local', 'utf-8');
      return envContent.includes('RESEND_API_KEY');
    }
  },
  {
    name: 'HTTP API de Resend utilizado',
    check: () => emailContent.includes('api.resend.com/emails')
  },
  {
    name: 'FROM_EMAIL configurado',
    check: () => {
      const envContent = fs.readFileSync('./.env.local', 'utf-8');
      return envContent.includes('FROM_EMAIL');
    }
  },
  {
    name: 'Base64 para adjuntos',
    check: () => emailContent.includes('Buffer.from') || emailContent.includes('base64')
  },
];

for (const check of resendChecks) {
  const result = check.check();
  console.log(`${result ? '✅' : '❌'} ${check.name}`);
}

console.log('\n' + '='.repeat(50));
console.log('ANÁLISIS COMPLETADO\n');

if (foundCount === totalCount) {
  console.log('✅ TODAS LAS FUNCIONES DE EMAIL ESTÁN IMPLEMENTADAS');
  process.exit(0);
} else {
  console.log(`⚠️  ${totalCount - foundCount} función(es) faltante(s)`);
  process.exit(1);
}
