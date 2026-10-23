# Illustrations

Watercolour paintings, one per scene, named `<scene>-illustration.webp`
(for example `welcome-hero-illustration.webp`). The suffix matters: Xcode
flattens resource folders into the app bundle, so a plain `welcome-hero.webp`
would collide with the photograph of the same name. The app picks these up
automatically; no code change is needed. See `docs/illustration-prompts.md`
for the prompts, sizes and names.
