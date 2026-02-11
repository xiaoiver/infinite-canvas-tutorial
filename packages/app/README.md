## Features

Tools in server & client side:

-   generate image
-   insert image into canvas
-   vectorize image
-   decompose image

## How to deploy

This application is deployed on vercel.

### Auth with Supabase

[SUPABASE_SETUP](./SUPABASE_SETUP.md)

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_..."
NEXT_PUBLIC_SUPABASE_URL="https://...supabase.co"
```

### Storage

I use [Vercel Blob] to store the uploaded & generated images.

```env
BLOB_READ_WRITE_TOKEN="..."
```

[Vercel Blob]: https://vercel.com/docs/vercel-blob
