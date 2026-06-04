import { create } from "zustand";

export type FunctionNodeData = {
  id: string;
  name: string;
  startLine?: number | null;
  endLine?: number | null;
  summary?: string | null;
  language?: string | null;
  code?: string | null;
};

export type ModuleData = {
  id: string;
  name: string;
  type: string;
  summary?: string | null;
  functions: FunctionNodeData[];
};

export type FileNodeData = {
  path?: string;
  language?: string;
  summary?: string;
  modules?: ModuleData[];
  role?: string;
  roleLabel?: string;
  group?: string;
  groupLabel?: string;
  framework?: string;
  frameworkLabel?: string;
  purpose?: string;
};

export type SelectedNode = {
  id: string;
  type: string;
  data: FileNodeData;
};

type GraphStore = {
  selectedNode: SelectedNode | null;
  setSelectedNode: (node: SelectedNode | null) => void;
};

export const useGraphStore = create<GraphStore>((set) => ({
  selectedNode: null,
  setSelectedNode: (node) => set({ selectedNode: node }),
}));
