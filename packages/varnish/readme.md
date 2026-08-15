# [`@404/varnish`]

response post-processing middleware for [snarl]

## features

- uses [`@minify-html/deno`] for html/css/js minification
- CSS scoping that prevents style leakage between components
- scoped stylesheet `<link>` tags are automatically injected into HTML responses based on which
  styles were marked as used during the request

## api

| Export                    | Description                                                  |
| :------------------------ | :----------------------------------------------------------- |
| **minify(options?)**      | HTML/CSS minification middleware                             |
| **scopedCss()**           | serves scoped stylesheets at `/_css/<hash>.css`              |
| **styleScopeInjection()** | injects <link> tags into HTML responses                      |
| **scopedStyling()**       | convenience combo of `scopedCss()` + `styleScopeInjection()` |
| **scopeCss(css, scope)**  | low-level CSS scoping function                               |
| **splitDoctype(html)**    | splits DOCTYPE from HTML body                                |

[`@404/varnish`]: https://kyu.re/~snarl
[snarl]: https://jsr.io/@july/snarl
[`@minify-html/deno`]: https://jsr.io/@minify-html/deno
