/**
 * Email Service for Invitations
 * Uses Resend or similar service in production
 */

export interface EmailTemplate {
    subject: string;
    html: string;
    text: string;
}

export interface InvitationEmailData {
    recipientEmail: string;
    recipientName?: string;
    clubName: string;
    inviterName: string;
    inviteLink: string;
    message?: string;
}

/**
 * Generate club invitation email
 */
export function generateClubInvitation(data: InvitationEmailData): EmailTemplate {
    const subject = `Inbjudan att gå med i ${data.clubName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .logo { font-size: 32px; }
    .content { background: #f3f4f6; border-radius: 12px; padding: 24px; margin: 20px 0; }
    .button { display: inline-block; background: linear-gradient(to right, #10b981, #14b8a6); color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏃‍♂️</div>
      <h1>OrienteerPro</h1>
    </div>
    
    <div class="content">
      <h2>Hej${data.recipientName ? ` ${data.recipientName}` : ''}!</h2>
      
      <p><strong>${data.inviterName}</strong> har bjudit in dig att gå med i <strong>${data.clubName}</strong> på OrienteerPro.</p>
      
      ${data.message ? `<p><em>"${data.message}"</em></p>` : ''}
      
      <p>OrienteerPro är en modern app för orientering med:</p>
      <ul>
        <li>📍 GPS-spårning och analys</li>
        <li>⏱️ Sträcktider och resultat</li>
        <li>🗺️ Kartor med GoKartor-integration</li>
        <li>👥 Lag och träningshantering</li>
      </ul>
      
      <center>
        <a href="${data.inviteLink}" class="button">Gå med i ${data.clubName}</a>
      </center>
      
      <p style="color: #6b7280; font-size: 14px;">
        Länken är giltig i 7 dagar. Om du inte förväntade dig denna inbjudan kan du ignorera detta mail.
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} OrienteerPro</p>
      <p>Skickad av ${data.clubName}</p>
    </div>
  </div>
</body>
</html>
  `.trim();

    const text = `
Hej${data.recipientName ? ` ${data.recipientName}` : ''}!

${data.inviterName} har bjudit in dig att gå med i ${data.clubName} på OrienteerPro.

${data.message ? `"${data.message}"\n` : ''}

Klicka på länken för att gå med:
${data.inviteLink}

Länken är giltig i 7 dagar.

---
© ${new Date().getFullYear()} OrienteerPro
  `.trim();

    return { subject, html, text };
}

/**
 * Generate event reminder email
 */
export function generateEventReminder(data: {
    recipientEmail: string;
    recipientName?: string;
    eventName: string;
    eventDate: string;
    eventTime: string;
    location?: string;
    className?: string;
}): EmailTemplate {
    const subject = `Påminnelse: ${data.eventName} - ${data.eventDate}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 20px 0; }
    .content { background: #fef3c7; border-radius: 12px; padding: 24px; margin: 20px 0; border-left: 4px solid #f59e0b; }
    .detail { margin: 8px 0; }
    .label { color: #6b7280; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="font-size: 32px;">⏰</div>
      <h1>Tävlingspåminnelse</h1>
    </div>
    
    <div class="content">
      <h2>${data.eventName}</h2>
      
      <div class="detail">
        <span class="label">📅 Datum:</span> <strong>${data.eventDate}</strong>
      </div>
      <div class="detail">
        <span class="label">🕐 Tid:</span> <strong>${data.eventTime}</strong>
      </div>
      ${data.location ? `
      <div class="detail">
        <span class="label">📍 Plats:</span> <strong>${data.location}</strong>
      </div>
      ` : ''}
      ${data.className ? `
      <div class="detail">
        <span class="label">🏃 Klass:</span> <strong>${data.className}</strong>
      </div>
      ` : ''}
    </div>
    
    <p>Glöm inte:</p>
    <ul>
      <li>SI-bricka och nålkompas</li>
      <li>Lämpliga kläder för terrängen</li>
      <li>Vatten och energi</li>
    </ul>
    
    <p>Lycka till! 🍀</p>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} OrienteerPro</p>
    </div>
  </div>
</body>
</html>
  `.trim();

    const text = `
Tävlingspåminnelse: ${data.eventName}

📅 Datum: ${data.eventDate}
🕐 Tid: ${data.eventTime}
${data.location ? `📍 Plats: ${data.location}\n` : ''}
${data.className ? `🏃 Klass: ${data.className}\n` : ''}

Glöm inte:
- SI-bricka och nålkompas
- Lämpliga kläder för terrängen
- Vatten och energi

Lycka till! 🍀

---
© ${new Date().getFullYear()} OrienteerPro
  `.trim();

    return { subject, html, text };
}

/**
 * Mock send function - replace with Resend/SendGrid in production
 */
export async function sendEmail(
    to: string,
    template: EmailTemplate
): Promise<{ success: boolean; error?: string }> {
    // In production, use Resend or similar:
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // await resend.emails.send({
    //   from: 'OrienteerPro <no-reply@orienteerpro.se>',
    //   to,
    //   subject: template.subject,
    //   html: template.html,
    //   text: template.text,
    // });

    console.log('📧 Email would be sent to:', to);
    console.log('Subject:', template.subject);
    console.log('---');

    return { success: true };
}

/**
 * Generate invitation link with token
 */
export function generateInviteToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

export function createInviteLink(baseUrl: string, token: string, clubId: string): string {
    return `${baseUrl}/invite/${token}?club=${clubId}`;
}
