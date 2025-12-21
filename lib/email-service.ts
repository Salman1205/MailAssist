/**
 * Email Service for sending OTP and invitation emails
 * Using Resend for reliable email delivery
 * 
 * Setup Instructions:
 * 1. Sign up at resend.com (free 3,000 emails/month)
 * 2. Get your API key from dashboard
 * 3. Add to .env.local: RESEND_API_KEY=re_xxxxx
 * 4. Verify your domain or use onboarding@resend.dev for testing
 */

import { Resend } from 'resend'

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY)

// Email configuration
const FROM_EMAIL = process.env.EMAIL_FROM || 'onboarding@resend.dev' // Change to your domain
const COMPANY_NAME = process.env.COMPANY_NAME || 'Email Support System'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface SendOTPEmailParams {
  to: string
  businessName: string
  ownerName: string
  otpCode: string
}

interface SendInvitationEmailParams {
  to: string
  inviteeName: string
  inviterName: string
  businessName: string
  role: string
  invitationLink: string
}

/**
 * Send OTP verification email for business registration
 */
export async function sendOTPEmail({
  to,
  businessName,
  ownerName,
  otpCode,
}: SendOTPEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Verify your ${COMPANY_NAME} account - Code: ${otpCode}`,
      html: getOTPEmailTemplate({
        businessName,
        ownerName,
        otpCode,
      }),
    })

    if (error) {
      console.error('[Email Service] Failed to send OTP email:', error)
      throw new Error(`Failed to send OTP email: ${error.message}`)
    }

    console.log('[Email Service] OTP email sent successfully:', data?.id)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('[Email Service] Error sending OTP email:', error)
    throw error
  }
}

/**
 * Send agent invitation email
 */
export async function sendInvitationEmail({
  to,
  inviteeName,
  inviterName,
  businessName,
  role,
  invitationLink,
}: SendInvitationEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `You've been invited to join ${businessName} on ${COMPANY_NAME}`,
      html: getInvitationEmailTemplate({
        inviteeName,
        inviterName,
        businessName,
        role,
        invitationLink,
      }),
    })

    if (error) {
      console.error('[Email Service] Failed to send invitation email:', error)
      throw new Error(`Failed to send invitation email: ${error.message}`)
    }

    console.log('[Email Service] Invitation email sent successfully:', data?.id)
    return { success: true, messageId: data?.id }
  } catch (error) {
    console.error('[Email Service] Error sending invitation email:', error)
    throw error
  }
}

/**
 * OTP Email Template
 */
function getOTPEmailTemplate({
  businessName,
  ownerName,
  otpCode,
}: {
  businessName: string
  ownerName: string
  otpCode: string
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                Welcome to ${COMPANY_NAME}!
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${ownerName}</strong>,
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for registering <strong>${businessName}</strong> with us! 
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                To complete your registration and verify your email address, please use the following one-time password (OTP):
              </p>
              
              <!-- OTP Code -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                <tr>
                  <td align="center" style="background-color: #f8f9fa; border-radius: 8px; padding: 30px;">
                    <div style="font-size: 48px; font-weight: bold; color: #667eea; letter-spacing: 10px; font-family: 'Courier New', monospace;">
                      ${otpCode}
                    </div>
                  </td>
                </tr>
              </table>
              
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                ⏱️ This code will expire in <strong>10 minutes</strong>.
              </p>
              
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                🔒 For security reasons, never share this code with anyone.
              </p>
              
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #856404; font-size: 14px; line-height: 1.5; margin: 0;">
                  <strong>⚠️ Didn't request this?</strong><br>
                  If you didn't register for ${COMPANY_NAME}, please ignore this email. Your email address will not be used.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; font-size: 12px; line-height: 1.5; margin: 0 0 10px 0;">
                © ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.
              </p>
              <p style="color: #6c757d; font-size: 12px; line-height: 1.5; margin: 0;">
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

/**
 * Agent Invitation Email Template
 */
function getInvitationEmailTemplate({
  inviteeName,
  inviterName,
  businessName,
  role,
  invitationLink,
}: {
  inviteeName: string
  inviterName: string
  businessName: string
  role: string
  invitationLink: string
}) {
  const roleColors: Record<string, string> = {
    admin: '#dc3545',
    manager: '#667eea',
    agent: '#28a745',
  }
  
  const roleColor = roleColors[role.toLowerCase()] || '#667eea'
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                🎉 You're Invited!
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hi <strong>${inviteeName}</strong>,
              </p>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                <strong>${inviterName}</strong> has invited you to join <strong>${businessName}</strong> on ${COMPANY_NAME}.
              </p>
              
              <!-- Role Badge -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: ${roleColor}; color: #ffffff; padding: 10px 24px; border-radius: 20px; font-size: 14px; font-weight: bold; text-transform: uppercase;">
                      ${role} Role
                    </div>
                  </td>
                </tr>
              </table>
              
              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                As a <strong>${role}</strong>, you'll be able to manage customer support tickets, collaborate with your team, and provide excellent service to your customers.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${invitationLink}" style="display: inline-block; background-color: #667eea; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                      Accept Invitation →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                Or copy and paste this link into your browser:
              </p>
              
              <p style="color: #667eea; font-size: 12px; line-height: 1.6; margin: 0 0 20px 0; word-break: break-all;">
                ${invitationLink}
              </p>
              
              <div style="background-color: #e7f3ff; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #1565c0; font-size: 14px; line-height: 1.5; margin: 0;">
                  <strong>⏱️ This invitation expires in 7 days.</strong><br>
                  Accept it soon to get started!
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
              <p style="color: #6c757d; font-size: 12px; line-height: 1.5; margin: 0 0 10px 0;">
                © ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.
              </p>
              <p style="color: #6c757d; font-size: 12px; line-height: 1.5; margin: 0;">
                This invitation was sent by ${businessName}. If you weren't expecting this, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

/**
 * Fallback: Console-only mode for development without Resend
 */
export async function sendOTPEmailDevelopment({
  to,
  businessName,
  ownerName,
  otpCode,
}: SendOTPEmailParams) {
  console.log('\n' + '='.repeat(60))
  console.log('📧 [DEV MODE] OTP Email (not actually sent)')
  console.log('='.repeat(60))
  console.log(`To: ${to}`)
  console.log(`Business: ${businessName}`)
  console.log(`Owner: ${ownerName}`)
  console.log(`\n🔐 OTP CODE: ${otpCode}`)
  console.log('\n⏱️  Expires in 10 minutes')
  console.log('='.repeat(60) + '\n')
  
  return { success: true, messageId: 'dev-mode' }
}

// Export the appropriate function based on environment
export const sendEmail = {
  otp: process.env.RESEND_API_KEY ? sendOTPEmail : sendOTPEmailDevelopment,
  invitation: sendInvitationEmail,
}
