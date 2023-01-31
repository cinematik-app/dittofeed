import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import prisma from "backend-lib/src/prisma";
import { EmailProvider } from "backend-lib/src/types";
import { FastifyInstance } from "fastify";
import {
  EmailProviderResource,
  EmailProviderType,
  UpsertEmailProviderResource,
} from "isomorphic-lib/src/types";

// eslint-disable-next-line @typescript-eslint/require-await
export default async function settingsController(fastify: FastifyInstance) {
  fastify.withTypeProvider<TypeBoxTypeProvider>().put(
    "/email-providers",
    {
      schema: {
        description: "Create or update email provider settings",
        body: UpsertEmailProviderResource,
        response: {
          200: EmailProviderResource,
        },
      },
    },
    async (request, reply) => {
      let emailProvider: EmailProvider;
      const { id, workspaceId, type, apiKey } = request.body;
      const canCreate = workspaceId && type && apiKey;

      if (workspaceId && type) {
        if (canCreate) {
          emailProvider = await prisma.emailProvider.upsert({
            where: {
              workspaceId_type: {
                workspaceId,
                type,
              },
            },
            create: {
              id,
              workspaceId,
              type,
              apiKey,
            },
            update: {
              workspaceId,
              type,
              apiKey,
            },
          });
        } else {
          emailProvider = await prisma.emailProvider.update({
            where: {
              workspaceId_type: {
                workspaceId,
                type,
              },
            },
            data: {
              id,
              workspaceId,
              type,
              apiKey,
            },
          });
        }
      } else if (id) {
        emailProvider = await prisma.emailProvider.update({
          where: {
            id,
          },
          data: {
            id,
            workspaceId,
            type,
            apiKey,
          },
        });
      } else {
        return reply.status(400).send();
      }

      let recordType: EmailProviderType;
      switch (emailProvider.type) {
        case EmailProviderType.Sendgrid:
          recordType = EmailProviderType.Sendgrid;
          break;
        default:
          throw new Error(
            `unknown email provider record type ${  emailProvider.type}`
          );
      }
      const resource: EmailProviderResource = {
        id: emailProvider.id,
        type: recordType,
        apiKey: emailProvider.apiKey,
        workspaceId: emailProvider.workspaceId,
      };
      return reply.status(200).send(resource);
    }
  );
}