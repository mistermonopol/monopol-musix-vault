export type BrainNodeType = 'track' | 'artist' | 'album' | 'genre' | 'playlist' | 'favorites';
export type BrainEdgeType = 'artist' | 'album' | 'genre' | 'playlist' | 'favorite';
export type BrainNodeProperties = Readonly<Record<string, boolean | number | string | null>>;
export interface BrainGraphNode {
  readonly id: string;
  readonly label: string;
  readonly properties: BrainNodeProperties;
  readonly type: BrainNodeType;
}
export interface BrainGraphEdge { readonly id: string; readonly source: string; readonly target: string; readonly type: BrainEdgeType }
export interface BrainGraph { readonly edges: readonly BrainGraphEdge[]; readonly nodes: readonly BrainGraphNode[] }
export interface BrainGraphOperations { get(userId: string): Promise<BrainGraph> }
