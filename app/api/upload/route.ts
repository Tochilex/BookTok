import { MAX_FILE_SIZE } from "@/lib/constants";
import { auth } from "@clerk/nextjs/server";
import { handleUpload, HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
    

    try {
        const body = (await request.json()) as HandleUploadBody;
        
        const jsonResponse = await handleUpload({
            token: process.env.BLOB_READ_WRITE_TOKEN, 
            body, 
            request, 
            onBeforeGenerateToken: async () => {
            const { userId } = await auth();

            if (!userId) {
                throw new Error ('Unauthorized: User not authenticated');
            }

            return {
                allowedContentTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
                addRandomsuffix: true,
                maximumSizeInBytes: MAX_FILE_SIZE,
                tokenPayLoad: JSON.stringify({ userId }),
            }
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
            console.log('File uploaded to blob storage', blob.url)

            const payload = tokenPayload ? JSON.parse(tokenPayload) : null;
            const userId = payload?.userId;

            // TODO: PostHog
            
        }           
    
    })
    return NextResponse.json(jsonResponse);

    } catch (e) {
        const message = e instanceof Error ? e.message : "An unknown error occured";
        const status = message.includes('Unauthorized') ? 401 : 500;
        console.error('Upload error:', e);

        const clientMessage = status === 401 ? 'Unauthorized' : 'Upload failed';
        return NextResponse.json({ error: clientMessage }, { status });
    }
}