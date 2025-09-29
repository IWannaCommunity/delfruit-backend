declare const tags: unique symbol;

/**
 * @description Implemented a Tagged/Branded opaque union type as
 * described in {@link AdvancedTS1} and {@link AdvancedTS2}.
 * {@link https://medium.com/@ethanresnick/advanced-typescript-tagged-types-for-fewer-bugs-and-better-security-24db681d5721 AdvancedTS1}.
 * {@link https://medium.com/@ethanresnick/advanced-typescript-tagged-types-improved-with-type-level-metadata-5072fc125fcf AdvancedTS2}.
 */
export type Tagged<T, Tag extends PropertyKey, Metadata = void> = T & {
	[tags]: { [K in Tag]: Metadata };
};
