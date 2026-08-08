export type BrainNodeType = 'track' | 'artist' | 'album' | 'genre';
export interface BrainGraphNode { readonly id: string; readonly label: string; readonly type: BrainNodeType }
export interface BrainGraphEdge { readonly id: string; readonly source: string; readonly target: string; readonly type: 'artist' | 'album' | 'genre' }
export interface BrainGraph { readonly edges: readonly BrainGraphEdge[]; readonly nodes: readonly BrainGraphNode[] }
export interface BrainGraphOperations { get(): Promise<BrainGraph> }
