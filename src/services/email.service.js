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

async function sendProfileCompletionEmail({ to, firstName, completionUrl, expiresAt }) {
  const expiry = new Date(expiresAt).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `Complete your MEST profile, ${firstName}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; background: #ffffff;">
        <div style="background: #0d968b; padding: 28px 32px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">MEST</p>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #0f172a;">Hi ${firstName},</h2>
          <p style="margin: 0 0 16px; font-size: 15px; color: #475569; line-height: 1.7;">
            Welcome to MEST! Use the link below to complete your trainee profile. You can add your photo, bio, and social links — it only takes a minute.
          </p>
          <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">You can update: <strong style="color: #0f172a;">Photo · Bio · LinkedIn · GitHub · Portfolio</strong></p>

          <a href="${completionUrl}"
             style="display: inline-block; padding: 14px 32px; background: #0d968b; color: #ffffff;
                    text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
            Complete My Profile →
          </a>

          <div style="margin: 28px 0; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;">Link expires</p>
            <p style="margin: 0; font-size: 13px; color: #475569;">
              This link is personal to you — please do not share it. It expires on <strong style="color: #0f172a;">${expiry}</strong>.
            </p>
          </div>

          <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8;">If the button doesn't work, copy this link:</p>
          <p style="margin: 0; font-size: 12px; color: #0d968b; word-break: break-all;">
            <a href="${completionUrl}" style="color: #0d968b;">${completionUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
          <p style="margin: 0; font-size: 12px; color: #cbd5e1;">© ${new Date().getFullYear()} Meltwater Entrepreneurial School of Technology</p>
        </div>
      </div>
    `,
  });
}

async function sendTeamCompletionEmail({ to, teamLeadName, teamName, completionUrl, expiresAt }) {
  const expiry = new Date(expiresAt).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `Fill in your team details — ${teamName}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; background: #ffffff;">
        <div style="background: #0d968b; padding: 28px 32px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">MEST</p>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #0f172a;">Hi ${teamLeadName},</h2>
          <p style="margin: 0 0 16px; font-size: 15px; color: #475569; line-height: 1.7;">
            As team lead of <strong style="color: #0f172a;">${teamName}</strong>, please take a moment to fill in your team's details. This helps mentors and judges understand what you're building.
          </p>
          <p style="margin: 0 0 24px; font-size: 14px; color: #64748b;">You can fill in: <strong style="color: #0f172a;">Product Idea · Market Focus</strong></p>

          <a href="${completionUrl}"
             style="display: inline-block; padding: 14px 32px; background: #0d968b; color: #ffffff;
                    text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
            Fill In Team Details →
          </a>

          <div style="margin: 28px 0; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;">Link expires</p>
            <p style="margin: 0; font-size: 13px; color: #475569;">
              This link is for your team — it expires on <strong style="color: #0f172a;">${expiry}</strong>.
            </p>
          </div>

          <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8;">If the button doesn't work, copy this link:</p>
          <p style="margin: 0; font-size: 12px; color: #0d968b; word-break: break-all;">
            <a href="${completionUrl}" style="color: #0d968b;">${completionUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
          <p style="margin: 0; font-size: 12px; color: #cbd5e1;">© ${new Date().getFullYear()} Meltwater Entrepreneurial School of Technology</p>
        </div>
      </div>
    `,
  });
}

async function sendSubmissionOtpEmail({ to, teamName, otp, title }) {
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `Your submission code — ${title}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; background: #ffffff;">
        <div style="background: #0d968b; padding: 28px 32px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">MEST</p>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #0f172a;">Submission access code</h2>
          <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.7;">
            Use this code to access the submission form for <strong style="color: #0f172a;">${title}</strong> on behalf of <strong style="color: #0f172a;">${teamName}</strong>.
            This code expires in <strong>10 minutes</strong>.
          </p>
          <div style="text-align: center; margin: 0 0 28px;">
            <span style="display: inline-block; font-size: 36px; font-weight: 900; letter-spacing: 0.2em; color: #0d968b; background: #f0fdfb; border: 2px solid #0d968b; border-radius: 12px; padding: 16px 32px;">
              ${otp}
            </span>
          </div>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
          <p style="margin: 0; font-size: 12px; color: #cbd5e1;">© ${new Date().getFullYear()} Meltwater Entrepreneurial School of Technology</p>
        </div>
      </div>
    `,
  });
}

async function sendDeliverableNotificationEmail({ to, firstName, teamName, title, description, deadline, acceptedTypes, submissionUrl }) {
  const deadlineStr = new Date(deadline).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const typesList = acceptedTypes.join(', ').toUpperCase();

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `New deliverable: ${title}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; background: #ffffff;">
        <div style="background: #0d968b; padding: 28px 32px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">MEST</p>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #0f172a;">Hi ${firstName},</h2>
          <p style="margin: 0 0 20px; font-size: 15px; color: #475569; line-height: 1.7;">
            A new deliverable has been assigned to <strong style="color: #0f172a;">${teamName}</strong>.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 0 0 24px;">
            <p style="margin: 0 0 4px; font-size: 18px; font-weight: 800; color: #0f172a;">${title}</p>
            ${description ? `<p style="margin: 8px 0 0; font-size: 14px; color: #64748b; line-height: 1.6;">${description}</p>` : ''}
            <div style="margin: 16px 0 0; display: flex; gap: 16px; flex-wrap: wrap;">
              <div>
                <p style="margin: 0 0 2px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;">Deadline</p>
                <p style="margin: 0; font-size: 13px; font-weight: 600; color: #ef4444;">${deadlineStr}</p>
              </div>
              <div>
                <p style="margin: 0 0 2px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;">Accepted formats</p>
                <p style="margin: 0; font-size: 13px; font-weight: 600; color: #0f172a;">${typesList}</p>
              </div>
            </div>
          </div>

          <a href="${submissionUrl}"
             style="display: inline-block; padding: 14px 32px; background: #0d968b; color: #ffffff;
                    text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
            Submit Your Work →
          </a>

          <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8;">
            Or copy this link: <a href="${submissionUrl}" style="color: #0d968b; word-break: break-all;">${submissionUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
          <p style="margin: 0; font-size: 12px; color: #cbd5e1;">© ${new Date().getFullYear()} Meltwater Entrepreneurial School of Technology</p>
        </div>
      </div>
    `,
  });
}

async function sendDeadlineReminderEmail({ to, firstName, teamName, title, deadline, submissionUrl }) {
  const deadlineStr = new Date(deadline).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const hoursLeft = Math.max(0, Math.round((new Date(deadline) - Date.now()) / 3600000));

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `Reminder: "${title}" is due soon`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; background: #ffffff;">
        <div style="background: #f59e0b; padding: 28px 32px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">MEST</p>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #0f172a;">Hi ${firstName}, don't forget!</h2>
          <p style="margin: 0 0 20px; font-size: 15px; color: #475569; line-height: 1.7;">
            <strong style="color: #0f172a;">${teamName}</strong> has not yet submitted <strong style="color: #0f172a;">${title}</strong>.
            ${hoursLeft > 0 ? `You have approximately <strong style="color: #ef4444;">${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}</strong> left.` : 'The deadline is very soon.'}
          </p>

          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 16px; margin: 0 0 24px;">
            <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #fb923c;">Deadline</p>
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #c2410c;">${deadlineStr}</p>
          </div>

          <a href="${submissionUrl}"
             style="display: inline-block; padding: 14px 32px; background: #0d968b; color: #ffffff;
                    text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
            Submit Now →
          </a>

          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
          <p style="margin: 0; font-size: 12px; color: #cbd5e1;">© ${new Date().getFullYear()} Meltwater Entrepreneurial School of Technology</p>
        </div>
      </div>
    `,
  });
}

async function sendProfessionalFeedbackEmail({ to, firstName, teamName, eventName, letter }) {
  const paragraphs = letter
    .split('\n\n')
    .filter((p) => p.trim())
    .map((p) => `<p style="margin: 0 0 18px; font-size: 15px; color: #374151; line-height: 1.8;">${p.trim()}</p>`)
    .join('');

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `Evaluation Feedback — ${teamName}`,
    html: `
      <div style="font-family: Inter, Georgia, serif; max-width: 620px; margin: 0 auto; color: #1a1a1a; background: #ffffff;">
        <!-- Header -->
        <div style="background: #0d968b; padding: 28px 40px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">MEST</p>
        </div>

        <!-- Body -->
        <div style="padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af;">
            Official Evaluation Feedback
          </p>
          <h2 style="margin: 0 0 4px; font-size: 22px; font-weight: 800; color: #0f172a;">${teamName}</h2>
          <p style="margin: 0 0 32px; font-size: 14px; color: #6b7280;">${eventName}</p>

          <p style="margin: 0 0 18px; font-size: 15px; color: #374151;">Dear ${firstName},</p>
          <p style="margin: 0 0 18px; font-size: 15px; color: #374151;">
            Please find below the official evaluation feedback from MEST for your team, <strong style="color: #0f172a;">${teamName}</strong>.
          </p>

          <div style="border-left: 3px solid #0d968b; padding-left: 20px; margin: 0 0 32px;">
            ${paragraphs}
          </div>

          <p style="margin: 0 0 4px; font-size: 15px; color: #374151;">Warm regards,</p>
          <p style="margin: 0 0 32px; font-size: 15px; font-weight: 700; color: #0f172a;">The MEST Programme Team</p>

          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 0 0 20px;" />
          <p style="margin: 0; font-size: 12px; color: #d1d5db;">
            © ${new Date().getFullYear()} Meltwater Entrepreneurial School of Technology. This feedback is confidential and intended solely for the named recipient.
          </p>
        </div>
      </div>
    `,
  });
}

async function sendEvaluationFeedbackEmail({ to, firstName, teamName, eventName, kpiScores, overallComments, teamInsight }) {
  function scaleLabel(kpi, avg) {
    if (avg === null) return 'No scores yet';
    switch (kpi.scaleType) {
      case '1_to_5': return `${avg} / 5`;
      case '1_to_10': return `${avg} / 10`;
      case 'percentage': return `${avg}%`;
      default: return `${avg}`;
    }
  }

  const kpiRows = kpiScores
    .filter((k) => k.avg !== null)
    .map((k) => {
      const comments = k.entries.filter((e) => e.comment).map((e) => e.comment);
      const recs = k.entries.filter((e) => e.recommendation).map((e) => e.recommendation);
      return `
        <div style="margin: 0 0 20px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin: 0 0 8px;">
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #0f172a;">${k.kpi.name}</p>
            <span style="font-size: 16px; font-weight: 800; color: #0d968b;">${scaleLabel(k.kpi, k.avg)}</span>
          </div>
          ${comments.length > 0 ? `
            <p style="margin: 8px 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;">Expert comments</p>
            ${comments.map((c) => `<p style="margin: 4px 0; font-size: 13px; color: #475569; line-height: 1.6; padding-left: 10px; border-left: 2px solid #e2e8f0;">${c}</p>`).join('')}
          ` : ''}
          ${recs.length > 0 ? `
            <p style="margin: 8px 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8;">Recommendations</p>
            ${recs.map((r) => `<p style="margin: 4px 0; font-size: 13px; color: #475569; line-height: 1.6; padding-left: 10px; border-left: 2px solid #0d968b;">${r}</p>`).join('')}
          ` : ''}
        </div>
      `;
    }).join('');

  const overallSection = overallComments.length > 0 ? `
    <h3 style="margin: 28px 0 12px; font-size: 15px; font-weight: 800; color: #0f172a;">Overall Expert Comments</h3>
    ${overallComments.map((c) => `
      <div style="margin: 0 0 10px; padding: 14px 16px; background: #f0fdfb; border: 1px solid #99f6e4; border-radius: 8px;">
        <p style="margin: 0; font-size: 13px; color: #0f172a; line-height: 1.7;">${c}</p>
      </div>
    `).join('')}
  ` : '';

  const readinessColors = {
    investor_ready: '#16a34a',
    near_ready: '#0d968b',
    needs_work: '#d97706',
    early_stage: '#64748b',
  };
  const readinessLabels = {
    investor_ready: 'Investor Ready',
    near_ready: 'Near Ready',
    needs_work: 'Needs Work',
    early_stage: 'Early Stage',
  };

  const insightSection = teamInsight ? `
    <h3 style="margin: 28px 0 12px; font-size: 15px; font-weight: 800; color: #0f172a;">AI Summary</h3>
    <div style="padding: 20px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 10px;">
      ${teamInsight.readinessLevel ? `
        <span style="display: inline-block; margin: 0 0 12px; padding: 4px 12px; background: ${readinessColors[teamInsight.readinessLevel] || '#64748b'}22; color: ${readinessColors[teamInsight.readinessLevel] || '#64748b'}; border-radius: 20px; font-size: 12px; font-weight: 700;">
          ${readinessLabels[teamInsight.readinessLevel] || teamInsight.readinessLevel}
        </span>
      ` : ''}
      ${teamInsight.verdict ? `<p style="margin: 0 0 16px; font-size: 14px; color: #475569; line-height: 1.7; font-style: italic;">"${teamInsight.verdict}"</p>` : ''}
      ${teamInsight.strengths?.length > 0 ? `
        <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #16a34a;">Strengths</p>
        <ul style="margin: 0 0 14px; padding-left: 18px;">
          ${teamInsight.strengths.map((s) => `<li style="font-size: 13px; color: #475569; line-height: 1.7; margin-bottom: 4px;">${s}</li>`).join('')}
        </ul>
      ` : ''}
      ${teamInsight.improvements?.length > 0 ? `
        <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #d97706;">Areas to Improve</p>
        <ul style="margin: 0 0 14px; padding-left: 18px;">
          ${teamInsight.improvements.map((i) => `<li style="font-size: 13px; color: #475569; line-height: 1.7; margin-bottom: 4px;">${i}</li>`).join('')}
        </ul>
      ` : ''}
      ${teamInsight.recommendation ? `
        <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #0d968b;">Key Recommendation</p>
        <p style="margin: 0; font-size: 13px; color: #0f172a; font-weight: 600; line-height: 1.7;">${teamInsight.recommendation}</p>
      ` : ''}
    </div>
  ` : '';

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `Expert evaluation results — ${teamName}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; background: #ffffff;">
        <div style="background: #0d968b; padding: 28px 32px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">MEST</p>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #0f172a;">Hi ${firstName},</h2>
          <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.7;">
            Here are the expert evaluation results for <strong style="color: #0f172a;">${teamName}</strong> from <strong style="color: #0f172a;">${eventName}</strong>.
          </p>
          <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 800; color: #0f172a;">KPI Scores</h3>
          ${kpiRows || '<p style="font-size: 13px; color: #94a3b8;">No scores available yet.</p>'}
          ${overallSection}
          ${insightSection}
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
          <p style="margin: 0; font-size: 12px; color: #cbd5e1;">© ${new Date().getFullYear()} Meltwater Entrepreneurial School of Technology</p>
        </div>
      </div>
    `,
  });
}

async function sendTraineePortalOtpEmail({ to, firstName, otp }) {
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: 'Your MEST portal access code',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; background: #ffffff;">
        <div style="background: #0d968b; padding: 28px 32px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">MEST</p>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #0f172a;">Hi ${firstName},</h2>
          <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.7;">
            Use this code to sign in to your MEST trainee portal. It expires in <strong>10 minutes</strong>.
          </p>
          <div style="text-align: center; margin: 0 0 28px;">
            <span style="display: inline-block; font-size: 36px; font-weight: 900; letter-spacing: 0.2em; color: #0d968b; background: #f0fdfb; border: 2px solid #0d968b; border-radius: 12px; padding: 16px 32px;">
              ${otp}
            </span>
          </div>
          <p style="margin: 0 0 0; font-size: 13px; color: #94a3b8;">If you did not request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
          <p style="margin: 0; font-size: 12px; color: #cbd5e1;">© ${new Date().getFullYear()} Meltwater Entrepreneurial School of Technology</p>
        </div>
      </div>
    `,
  });
}

async function sendTeamPortalInviteEmail({ to, firstName, teamName, portalUrl }) {
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `Your ${teamName} team portal is ready`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; background: #ffffff;">
        <div style="background: #0d968b; padding: 28px 32px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">MEST</p>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #0f172a;">Hi ${firstName},</h2>
          <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.7;">
            Your team portal for <strong style="color: #0f172a;">${teamName}</strong> is now available.
            Track your evaluation feedback, mentor sessions, activities, and team progress all in one place.
          </p>
          <a href="${portalUrl}"
             style="display: inline-block; padding: 14px 32px; background: #0d968b; color: #ffffff;
                    text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px;">
            Open Team Portal →
          </a>
          <p style="margin: 24px 0 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
            Enter your email address on the portal page to receive a one-time access code.
          </p>
        </div>
      </div>
    `,
  });
}

async function sendTeamPortalOtpEmail({ to, firstName, teamName, otp }) {
  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: 'Your MEST team portal access code',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; background: #ffffff;">
        <div style="background: #0d968b; padding: 28px 32px; border-radius: 12px 12px 0 0;">
          <p style="margin: 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">MEST</p>
        </div>
        <div style="padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 800; color: #0f172a;">Hi ${firstName},</h2>
          <p style="margin: 0 0 24px; font-size: 15px; color: #475569; line-height: 1.7;">
            Here is your one-time access code for the <strong style="color: #0f172a;">${teamName}</strong> team portal.
          </p>
          <div style="text-align: center; margin: 32px 0; padding: 28px; background: #f0fdfa; border-radius: 12px; border: 1px solid #99f6e4;">
            <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #0d968b;">Your access code</p>
            <p style="margin: 0; font-size: 42px; font-weight: 900; letter-spacing: 0.2em; color: #0d968b;">${otp}</p>
            <p style="margin: 8px 0 0; font-size: 12px; color: #64748b;">Expires in 10 minutes</p>
          </div>
          <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
            If you did not request this code, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
  });
}

module.exports = {
  sendInviteEmail, sendPasswordResetEmail, sendEvaluationLinkEmail, sendEvaluationFeedbackEmail, sendProfessionalFeedbackEmail,
  sendProfileCompletionEmail, sendTeamCompletionEmail, sendSubmissionOtpEmail,
  sendDeliverableNotificationEmail, sendDeadlineReminderEmail,
  sendTraineePortalOtpEmail, sendTeamPortalOtpEmail, sendTeamPortalInviteEmail,
};
