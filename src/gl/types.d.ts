export type ProgramOpts = {
	shaders?: Iterable<[type: number, src: string]>

	uniforms?: string[]

	attributes?: string[]
}
