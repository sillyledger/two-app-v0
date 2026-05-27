import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await sql`
    SELECT email, trial_ends_at FROM users
    WHERE plan = 'pro' AND trial_ends_at IS NOT NULL
  `

  const now = new Date()
  let sent = 0

  for (const user of users) {
    const trialEnd = new Date(user.trial_ends_at)
    const daysLeft = Math.round((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysLeft === 7) {
      await resend.emails.send({
        from: 'TWO <noreply@two.so>',
        to: user.email,
        subject: "You're halfway through your TWO Pro trial",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">7 days left on your Pro trial</h1>
            <p style="font-size: 15px; color: #555; margin-bottom: 24px;">You're halfway through your 14-day TWO Pro trial. Enjoying it so far?</p>
            <p style="font-size: 15px; color: #555; margin-bottom: 32px;">Add a payment method now to keep unlimited docs, workspaces, and 10GB storage after your trial ends.</p>
            <a href="https://app.two.so/settings" style="display: inline-block; background: #534AB7; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Keep my Pro access</a>
            <p style="font-size: 13px; color: #999; margin-top: 32px;">If you decide not to upgrade, your account will move to the free plan on ${trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
          </div>
        `,
      })
      sent++
    }

    if (daysLeft === 3) {
      await resend.emails.send({
        from: 'TWO <noreply@two.so>',
        to: user.email,
        subject: 'Your TWO Pro trial ends in 3 days',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">3 days left</h1>
            <p style="font-size: 15px; color: #555; margin-bottom: 24px;">Your TWO Pro trial ends on ${trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
            <p style="font-size: 15px; color: #555; margin-bottom: 32px;">After that, your account moves to the free plan — 30 docs and 1 workspace. Add a card now to keep everything.</p>
            <a href="https://app.two.so/settings" style="display: inline-block; background: #534AB7; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Add payment method</a>
            <p style="font-size: 13px; color: #999; margin-top: 32px;">No charge until your trial ends. Cancel anytime.</p>
          </div>
        `,
      })
      sent++
    }

    if (daysLeft === 1) {
      await resend.emails.send({
        from: 'TWO <noreply@two.so>',
        to: user.email,
        subject: 'Last day of your TWO Pro trial',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px;">
            <h1 style="font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px;">Your trial ends tomorrow</h1>
            <p style="font-size: 15px; color: #555; margin-bottom: 24px;">This is your last day on TWO Pro. Tomorrow your account moves to the free plan.</p>
            <p style="font-size: 15px; color: #555; margin-bottom: 32px;">Don't lose access to your unlimited docs and workspaces — add a payment method before midnight.</p>
            <a href="https://app.two.so/settings" style="display: inline-block; background: #534AB7; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">Keep Pro — $6/mo</a>
            <p style="font-size: 13px; color: #999; margin-top: 32px;">Questions? Reply to this email and we'll help.</p>
          </div>
        `,
      })
      sent++
    }
  }

  return NextResponse.json({ success: true, emailsSent: sent })
}
