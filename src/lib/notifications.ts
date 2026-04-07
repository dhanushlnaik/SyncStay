import { NotificationChannel, NotificationType, UserRole } from "@prisma/client";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

async function sendEmailNotification(to: string, subject: string, body: string) {
  if (!env.RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY missing. Email notification skipped", { to, subject });
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html: `<div style="font-family: Inter, Arial, sans-serif;"><p>${body}</p></div>`,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    logger.error("Failed to send notification email", { to, status: response.status, responseText });
  }
}

export async function createUserNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  sendEmail?: boolean;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      channel: NotificationChannel.IN_APP,
    },
  });

  if (input.sendEmail) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true },
    });

    if (user?.email) {
      await sendEmailNotification(user.email, input.title, input.body);
      await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          channel: NotificationChannel.EMAIL,
          sentAt: new Date(),
        },
      });
    }
  }

  return notification;
}

export async function notifyAdmins(input: {
  type: NotificationType;
  title: string;
  body: string;
  sendEmail?: boolean;
}) {
  const admins = await prisma.user.findMany({
    where: {
      role: UserRole.MASTER_ADMIN,
      isActive: true,
    },
    select: { id: true },
  });

  await Promise.all(
    admins.map((admin) =>
      createUserNotification({
        userId: admin.id,
        type: input.type,
        title: input.title,
        body: input.body,
        sendEmail: input.sendEmail,
      }),
    ),
  );
}
