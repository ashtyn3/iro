import type { Existable } from "./traits";

export type Component<Added, P = {}> = (
	base: Existable,
	params: P,
) => Existable & Added;

export type AddedOf<M> = M extends Component<infer A, any> ? A : never;

export type ParamsOf<M> = M extends Component<any, infer P> ? P : never;

export type UnionToIntersection<U> = (
	U extends any
		? (x: U) => void
		: never
) extends (x: infer I) => void
	? I
	: never;

export function applyMixins<M extends Array<Component<any, any>>>(
	base: Existable,
	...entries: {
		[K in keyof M]: [fn: M[K], params: ParamsOf<M[K]>];
	}
): Existable & UnionToIntersection<AddedOf<M[number]>> {
	return entries.reduce((ent, [fn, p]) => {
		ent._components = ent._components.add(Symbol.for(fn.name));
		return fn(ent, p);
	}, base) as any;
}
