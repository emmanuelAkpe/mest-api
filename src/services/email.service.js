const { Resend } = require('resend');
const { env } = require('../config/env');

const resend = new Resend(env.RESEND_API_KEY);

async function sendInviteEmail({ to, firstName, inviteUrl }) {
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: 'You have been invited to the MEST Admin Portal',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 8px;">Welcome to MEST, ${firstName}.</h2>
        <p style="color: #444; line-height: 1.6;">
          You have been invited to join the MEST Admin Portal. Click the button below to set up
          your account. This link expires in <strong>72 hours</strong>.
        </p>
        <a href="${inviteUrl}"
           style="display: inline-block; margin: 24px 0; padding: 12px 28px; background: #1a1a1a;
                  color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Accept Invitation
        </a>
        <p style="color: #888; font-size: 13px;">
          If the button does not work, copy and paste this link into your browser:<br/>
          <a href="${inviteUrl}" style="color: #555;">${inviteUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="color: #aaa; font-size: 12px;">
          If you were not expecting this invitation, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail({ to, firstName, resetUrl }) {
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: 'Reset your MEST Admin Portal password',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 8px;">Password reset request</h2>
        <p style="color: #444; line-height: 1.6;">
          Hi ${firstName}, we received a request to reset your password. Click the button below
          to choose a new one. This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetUrl}"
           style="display: inline-block; margin: 24px 0; padding: 12px 28px; background: #1a1a1a;
                  color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Reset Password
        </a>
        <p style="color: #888; font-size: 13px;">
          If the button does not work, copy and paste this link into your browser:<br/>
          <a href="${resetUrl}" style="color: #555;">${resetUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
        <p style="color: #aaa; font-size: 12px;">
          If you did not request a password reset, you can safely ignore this email.
          Your password will not change.
        </p>
      </div>
    `,
  });
}

module.exports = { sendInviteEmail, sendPasswordResetEmail };
