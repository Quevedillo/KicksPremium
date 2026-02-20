<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:template match="/">
    <html>
      <head>
        <title>Sitemap</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 30px;
          }
          h1 {
            color: #333;
            margin-top: 0;
            border-bottom: 3px solid #667eea;
            padding-bottom: 15px;
          }
          .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
          }
          .stat {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
          }
          .stat-number {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
          }
          .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            margin-top: 5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th {
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #eee;
          }
          tr:hover {
            background: #f9f9f9;
          }
          a {
            color: #667eea;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          .priority-high {
            color: #27ae60;
            font-weight: 600;
          }
          .priority-medium {
            color: #f39c12;
            font-weight: 600;
          }
          .priority-low {
            color: #95a5a6;
            font-weight: 600;
          }
          .lastmod {
            font-size: 12px;
            color: #666;
          }
          .footer {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🗺️ Sitemap - KicksPremium</h1>
          
          <div class="stats">
            <div class="stat">
              <div class="stat-number"><xsl:value-of select="count(//sitemap:url)"/></div>
              <div class="stat-label">URLs en Sitemap</div>
            </div>
            <div class="stat">
              <div class="stat-number"><xsl:value-of select="count(//sitemap:url[sitemap:priority >= 0.8])"/></div>
              <div class="stat-label">Prioridad Alta</div>
            </div>
            <div class="stat">
              <div class="stat-number"><xsl:value-of select="count(//sitemap:url[sitemap:priority >= 0.6 and sitemap:priority &lt; 0.8])"/></div>
              <div class="stat-label">Prioridad Media</div>
            </div>
            <div class="stat">
              <div class="stat-number"><xsl:value-of select="count(//sitemap:url[sitemap:priority &lt; 0.6])"/></div>
              <div class="stat-label">Prioridad Baja</div>
            </div>
          </div>

          <xsl:if test="//sitemap:sitemapindex">
            <h2>Índice de Sitemaps</h2>
            <table>
              <tr>
                <th>Sitemap</th>
                <th>Última Modificación</th>
              </tr>
              <xsl:for-each select="//sitemap:sitemap">
                <tr>
                  <td><a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a></td>
                  <td class="lastmod"><xsl:value-of select="sitemap:lastmod"/></td>
                </tr>
              </xsl:for-each>
            </table>
          </xsl:if>

          <xsl:if test="//sitemap:urlset">
            <h2>URLs Indexadas</h2>
            <table>
              <tr>
                <th>URL</th>
                <th>Última Modificación</th>
                <th>Actualización</th>
                <th>Prioridad</th>
              </tr>
              <xsl:for-each select="//sitemap:url">
                <tr>
                  <td><a href="{sitemap:loc}" target="_blank"><xsl:value-of select="sitemap:loc"/></a></td>
                  <td class="lastmod"><xsl:value-of select="sitemap:lastmod"/></td>
                  <td><xsl:value-of select="sitemap:changefreq"/></td>
                  <td>
                    <xsl:choose>
                      <xsl:when test="sitemap:priority >= 0.8">
                        <span class="priority-high"><xsl:value-of select="sitemap:priority"/></span>
                      </xsl:when>
                      <xsl:when test="sitemap:priority >= 0.6">
                        <span class="priority-medium"><xsl:value-of select="sitemap:priority"/></span>
                      </xsl:when>
                      <xsl:otherwise>
                        <span class="priority-low"><xsl:value-of select="sitemap:priority"/></span>
                      </xsl:otherwise>
                    </xsl:choose>
                  </td>
                </tr>
              </xsl:for-each>
            </table>
          </xsl:if>

          <div class="footer">
            <p>✅ Sitemap generado automáticamente por Astro + @astrojs/sitemap</p>
            <p>Este sitemap está indexado automáticamente en Google Search Console y Bing Webmaster Tools</p>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
