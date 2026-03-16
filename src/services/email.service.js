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

async function sendEvaluationLinkEmail({ to, evaluatorName, eventName, evalUrl, expiresAt }) {
  const expiry = new Date(expiresAt).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `You've been invited to evaluate: ${eventName}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; background: #ffffff;">
        <!-- Header -->
        <div style="background: #0d968b; padding: 28px 32px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
            MEST
          </p>
        </div>

        <!-- Body -->
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #0f172a;">
            Hi ${evaluatorName},
          </h2>
          <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.7;">
            You have been invited to evaluate teams at <strong style="color: #0f172a;">${eventName}</strong>.
            Your unique evaluation link is below — each team's context and scoring criteria are included.
          </p>

          <a href="${evalUrl}"
             style="display: inline-block; padding: 14px 32px; background: #0d968b; color: #ffffff;
                    text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
            Open Evaluation Form →
          </a>

          <div style="margin: 28px 0; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;
                      letter-spacing: 0.08em; color: #94a3b8;">Important</p>
            <p style="margin: 0; font-size: 13px; color: #475569;">
              This link is personal to you — please do not share it. It expires on
              <strong style="color: #0f172a;">${expiry}</strong>.
            </p>
          </div>

          <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8;">
            If the button doesn't work, copy this link into your browser:
          </p>
          <p style="margin: 0; font-size: 12px; color: #0d968b; word-break: break-all;">
            <a href="${evalUrl}" style="color: #0d968b;">${evalUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
          <p style="margin: 0; font-size: 12px; color: #cbd5e1;">
            © ${new Date().getFullYear()} Meltwater Entrepreneurial School of Technology
          </p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendInviteEmail, sendPasswordResetEmail, sendEvaluationLinkEmail };
