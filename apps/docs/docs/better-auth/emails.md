---
id: emails
title: Emails
sidebar_position: 6
---

# Emails

Better Auth can send transactional emails for password resets, email verification, magic links, two-factor OTPs, and more. Better Auth itself is email-provider agnostic — you wire up sending logic by providing callback functions in your auth config.

## Using better-auth-ui email templates

[`@better-auth-ui/react`](https://better-auth-ui.com) ships pre-built React Email components for every Better Auth email type. Combined with Strapi's built-in email plugin for delivery, this gives you polished transactional emails with minimal setup.

### 1. Install dependencies

```bash
npm install @better-auth-ui/react @react-email/render react
# or
pnpm add @better-auth-ui/react @react-email/render react
```

### 2. Create an email helper file

```typescript title="config/better-auth-emails.ts"
import type {
  DeviceInfo,
  EmailChangedEmailProps,
  EmailVerificationEmailProps,
  MagicLinkEmailProps,
  NewDeviceEmailProps,
  OtpEmailProps,
  PasswordChangedEmailProps,
  ResetPasswordEmailProps,
} from "@better-auth-ui/react";
import { render, toPlainText } from "@react-email/render";
import React from "react";

type EmailComponents = {
  EmailVerificationEmail: (
    props: EmailVerificationEmailProps,
  ) => React.ReactElement;
  OtpEmail: (props: OtpEmailProps) => React.ReactElement;
  ResetPasswordEmail: (props: ResetPasswordEmailProps) => React.ReactElement;
  MagicLinkEmail: (props: MagicLinkEmailProps) => React.ReactElement;
  EmailChangedEmail: (props: EmailChangedEmailProps) => React.ReactElement;
  NewDeviceEmail: (props: NewDeviceEmailProps) => React.ReactElement;
  PasswordChangedEmail: (
    props: PasswordChangedEmailProps,
  ) => React.ReactElement;
};

// Native dynamic import avoids TypeScript compiling this to require(),
// which fails for ESM-only packages like @better-auth-ui/react.
const importEmailComponents = () =>
  new Function(
    "return import('@better-auth-ui/react')",
  )() as Promise<EmailComponents>;

const APP_NAME = process.env.SITE_NAME ?? "Strapi Community";
const LOGO_URL = process.env.LOGO_URL ?? "/logo.svg";

async function sendEmail(
  to: string,
  subject: string,
  element: React.ReactElement,
): Promise<void> {
  if (process.env.ENABLE_MIGRATION === "true") {
    return;
  }
  const rawHtml = await render(element, { pretty: false });
  await strapi.plugins.email.services.email.send({
    to,
    subject,
    html: rawHtml,
    text: toPlainText(rawHtml),
  });
}

export async function sendVerificationEmail(
  to: string,
  url: string,
): Promise<void> {
  const { EmailVerificationEmail } = await importEmailComponents();
  await sendEmail(
    to,
    "Verify your email address",
    React.createElement(EmailVerificationEmail, {
      url,
      email: to,
      appName: APP_NAME,
      logoURL: LOGO_URL,
    }),
  );
}

export async function sendResetPasswordEmail(
  to: string,
  url: string,
): Promise<void> {
  const { ResetPasswordEmail } = await importEmailComponents();
  await sendEmail(
    to,
    "Reset your password",
    React.createElement(ResetPasswordEmail, {
      url,
      email: to,
      appName: APP_NAME,
      logoURL: LOGO_URL,
    }),
  );
}

export async function sendOtpEmail(
  to: string,
  otp: string,
  expirationMinutes = 3,
): Promise<void> {
  const { OtpEmail } = await importEmailComponents();
  await sendEmail(
    to,
    "Your two-factor authentication code",
    React.createElement(OtpEmail, {
      verificationCode: otp,
      email: to,
      appName: APP_NAME,
      logoURL: LOGO_URL,
      expirationMinutes,
    }),
  );
}

export async function sendMagicLinkEmail(
  to: string,
  url: string,
): Promise<void> {
  const { MagicLinkEmail } = await importEmailComponents();
  await sendEmail(
    to,
    "Your sign-in link",
    React.createElement(MagicLinkEmail, {
      url,
      email: to,
      appName: APP_NAME,
      logoURL: LOGO_URL,
    }),
  );
}

export async function sendEmailChangedEmail(
  to: string,
  oldEmail: string,
  newEmail: string,
  revertURL?: string,
): Promise<void> {
  const { EmailChangedEmail } = await importEmailComponents();
  await sendEmail(
    to,
    "Your email address has been changed",
    React.createElement(EmailChangedEmail, {
      oldEmail,
      newEmail,
      revertURL,
      appName: APP_NAME,
      logoURL: LOGO_URL,
    }),
  );
}

export async function sendNewDeviceEmail(
  to: string,
  deviceInfo: DeviceInfo,
): Promise<void> {
  const { NewDeviceEmail } = await importEmailComponents();
  await sendEmail(
    to,
    "New sign-in to your account",
    React.createElement(NewDeviceEmail, {
      userEmail: to,
      deviceInfo,
      appName: APP_NAME,
      logoURL: LOGO_URL,
    }),
  );
}

export async function sendPasswordChangedEmail(
  to: string,
  timestamp: string,
): Promise<void> {
  const { PasswordChangedEmail } = await importEmailComponents();
  await sendEmail(
    to,
    "Your password has been changed",
    React.createElement(PasswordChangedEmail, {
      email: to,
      timestamp,
      appName: APP_NAME,
      logoURL: LOGO_URL,
    }),
  );
}
```

:::note
The `new Function("return import(...)")()` pattern is required because `@better-auth-ui/react` is ESM-only. TypeScript normally compiles dynamic `import()` calls to `require()`, which fails for ESM packages. This trick keeps the import as a native `import()` at runtime.
:::

### 3. Wire the functions into your Better Auth config

```typescript title="src/lib/auth.ts"
import { betterAuth } from 'better-auth';
import { strapiAdapter } from '@strapi-community/plugin-better-auth';
import {
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendOtpEmail,
} from './better-auth-emails';

export const auth = betterAuth({
  database: strapiAdapter(),
  trustedOrigins: ['http://localhost:3000'],
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, url);
    },
  },
});
```

### Environment variables

```bash title=".env"
# Your app's display name — shown in email templates
SITE_NAME=My App

# Used to put your logo in to the email templates
LOGO_URL=http://localhost:3000/logo.svg
```

## Other approaches

- **Custom HTML templates** — return HTML strings directly in the callbacks without any template library.
- **Resend / SendGrid / Postmark** — call their SDK inside the callbacks instead of Strapi's email plugin. The Better Auth callback signatures stay the same regardless of delivery provider.
- **Queue-based sending** — push a job onto a queue inside the callback and process it asynchronously. Useful for high-volume or retry-heavy workflows.

Refer to the [Better Auth email documentation](https://www.better-auth.com/docs/concepts/email) for the full list of email hooks available.
