'use client';
import { useSyncExternalStore } from 'react';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import type { WorkflowRunner } from '../../workflows/workflow-runner';
export function useWorkflowRunner(): WorkflowRunner {
    const { workflowRunner } = useEditorSession().extensions;
    useSyncExternalStore(workflowRunner.subscribe, workflowRunner.getVersion, workflowRunner.getVersion);
    return workflowRunner;
}
