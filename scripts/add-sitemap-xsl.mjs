import fs from 'fs';
import path from 'path';

const dist = path.join(process.cwd(), 'dist', 'client');
const publicDir = path.join(process.cwd(), 'public');
const srcXsl = path.join(publicDir, 'sitemap.xsl');
const destXsl = path.join(dist, 'sitemap.xsl');

// Copiar el archivo XSL a la carpeta de distribución
if (fs.existsSync(srcXsl)) {
  fs.copyFileSync(srcXsl, destXsl);
  console.log('✅ Archivo sitemap.xsl copiado a dist/client/');
} else {
  console.log('⚠️ Archivo sitemap.xsl no encontrado en public/');
}

// Archivos de sitemap a procesar
const sitemapFiles = [
  path.join(dist, 'sitemap-index.xml'),
  path.join(dist, 'sitemap-0.xml'),
];

const xslStylesheet = '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>\n';

sitemapFiles.forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Si no tiene el stylesheet, lo agregamos
    if (!content.includes('xml-stylesheet')) {
      const xmlDeclaration = content.match(/^<\?xml[^?]*\?>/)[0];
      content = content.replace(
        xmlDeclaration,
        xmlDeclaration + '\n' + xslStylesheet
      );
      
      fs.writeFileSync(filePath, content);
      console.log(`✅ Stylesheet agregado a: ${path.basename(filePath)}`);
    } else {
      console.log(`ℹ️ Stylesheet ya existe en: ${path.basename(filePath)}`);
    }
  } else {
    console.log(`⚠️ Archivo no encontrado: ${path.basename(filePath)}`);
  }
});

console.log('✅ Procesamiento de sitemaps completado');
