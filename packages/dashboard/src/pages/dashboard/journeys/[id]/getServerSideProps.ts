import backendConfig from "backend-lib/src/config";
import { toJourneyResource } from "backend-lib/src/journeys";
import { toSegmentResource } from "backend-lib/src/segments";
import {
  CompletionStatus,
  MessageTemplateResource,
  TemplateResourceType,
} from "isomorphic-lib/src/types";
import { Result } from "neverthrow";
import { GetServerSideProps } from "next";
import { validate } from "uuid";

import {
  addInitialStateToProps,
  PreloadedState,
  PropsWithInitialState,
} from "../../../../lib/appStore";
import prisma from "../../../../lib/prisma";

type JourneyGetServerSideProps = GetServerSideProps<PropsWithInitialState>;

export const getServerSideProps: JourneyGetServerSideProps = async (ctx) => {
  const workspaceId = backendConfig().defaultWorkspaceId;
  const id = ctx.params?.id;

  if (typeof id !== "string" || !validate(id)) {
    return {
      notFound: true,
    };
  }

  const [journey, workspace, segments, emailTemplates] = await Promise.all([
    await prisma.journey.findUnique({
      where: { id },
    }),
    prisma.workspace.findFirst({
      where: { id: workspaceId },
    }),
    prisma.segment.findMany({
      where: { workspaceId },
    }),
    prisma.emailTemplate.findMany({
      where: { workspaceId },
    }),
  ]);

  const templateResources: MessageTemplateResource[] = emailTemplates.map(
    ({
      workspaceId: templateWorkspaceId,
      id: templateId,
      name,
      from,
      subject,
      body,
    }) => ({
      type: TemplateResourceType.Email,
      workspaceId: templateWorkspaceId,
      id: templateId,
      name,
      from,
      subject,
      body,
    })
  );

  const serverInitialState: PreloadedState = {
    messages: {
      type: CompletionStatus.Successful,
      value: templateResources,
    },
  };

  const journeyResourceResult = journey && toJourneyResource(journey);
  if (journeyResourceResult?.isOk()) {
    const journeyResource = journeyResourceResult.value;
    serverInitialState.journeys = {
      type: CompletionStatus.Successful,
      value: [journeyResource],
    };
    serverInitialState.journeyName = journeyResource.name;
  } else {
    serverInitialState.journeyName = `New Journey - ${id}`;
  }

  const segmentResourceResult = Result.combine(segments.map(toSegmentResource));

  if (segmentResourceResult.isOk()) {
    const segmentResource = segmentResourceResult.value;
    serverInitialState.segments = {
      type: CompletionStatus.Successful,
      value: segmentResource,
    };
  }

  if (workspace) {
    // TODO PLI-212
    serverInitialState.workspace = {
      type: CompletionStatus.Successful,
      value: {
        id: workspaceId,
        name: workspace.name,
      },
    };
  }

  const props = addInitialStateToProps({}, serverInitialState);

  return {
    props,
  };
};