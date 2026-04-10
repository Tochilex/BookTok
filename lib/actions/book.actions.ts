'use server';

import {CreateBook, TextSegment} from "@/types";
import {connectToDatabase} from "@/database/mongoose";
import {escapeRegex, generateSlug, serializeData} from "@/lib/utils";
import Book from "@/database/models/book.model";
import BookSegment from "@/database/models/book-segment.model";
//import mongoose from "mongoose";
//import {getUserPlan} from "@/lib/subscription.server";

// Action functions for book-related operations, such as creating a book, fetching books, and saving book segments. These functions are designed to be called from server components or API routes, and they handle all database interactions and business logic related to books.
// Most server-side action should have a try catch block to handle errors gracefully and return a consistent response structure. This allows the client-side components to easily handle success and error cases when calling these actions.


// export const getAllBooks = async (search?: string) => {
//     try {
//         await connectToDatabase();

//         let query = {};

//         if (search) {
//             const escapedSearch = escapeRegex(search);
//             const regex = new RegExp(escapedSearch, 'i');
//             query = {
//                 $or: [
//                     { title: { $regex: regex } },
//                     { author: { $regex: regex } },
//                 ]
//             };
//         }

//         const books = await Book.find(query).sort({ createdAt: -1 }).lean();

//         return {
//             success: true,
//             data: serializeData(books)
//         }
//     } catch (e) {
//         console.error('Error connecting to database', e);
//         return {
//             success: false, error: e
//         }
//     }
// }

export const getAllBooks = async () => {
    try {
        await connectToDatabase();

        const books = await Book.find().sort({ createdAt: -1}).lean();

        return {
            success: true,
            data: serializeData(books)
        }
    } catch (e) {
        console.error('Error connecting to database', e);
        return {
            success: false, error: e
        }
    }
}

export const checkBookExists = async (title: string) => {
    try {
        await connectToDatabase();

        const slug = generateSlug(title);

        const existingBook = await Book.findOne({slug}).lean();

        if(existingBook) {
            return {
                exists: true,
                book: serializeData(existingBook)
            }
        }

        return {
            exists: false,
        }
    } catch (e) {
        console.error('Error checking book exists', e);
        return {
            exists: false, error: e
        }
    }
}

export const getBookBySlug = async (slug: string) => {
    try {
        await connectToDatabase();

        const book = await Book.findOne({ slug }).lean();

        if (!book) {
            return { success: false, error: 'Book not found' };
        }

        return {
            success: true,
            data: serializeData(book)
        };
    } catch (e) {
        console.error('Error fetching book by slug', e);
        return {
            success: false, error: e
        };
    }
}

export const createBook = async (data: CreateBook) => {
    try {
        await connectToDatabase(); // Ensure database connection is established before performing any operations

        const slug = generateSlug(data.title); // Generate a URL-friendly slug from the book title

        const existingBook = await Book.findOne({slug}).lean();

        if(existingBook) {
            return {
                success: true,
                data: serializeData(existingBook), //serialize is to parse back big data object from Mongoose actions to JSON objects, frontend components
                alreadyExists: true,
            }
        }

        // Todo: Check subscription limits before creating a book
        //const { getUserPlan } = await import("@/lib/subscription.server");
        //const { PLAN_LIMITS } = await import("@/lib/subscription-constants");

        // const { auth } = await import("@clerk/nextjs/server");
        // const { userId } = await auth();

        // if (!userId || userId !== data.clerkId) {
        //     return { success: false, error: "Unauthorized" };
        // }

        // const plan = await getUserPlan();
        // const limits = PLAN_LIMITS[plan];

        // const bookCount = await Book.countDocuments({ clerkId: userId });

        // if (bookCount >= limits.maxBooks) {
        //     const { revalidatePath } = await import("next/cache");
        //     revalidatePath("/");

        //     return {
        //         success: false,
        //         error: `You have reached the maximum number of books allowed for your ${plan} plan (${limits.maxBooks}). Please upgrade to add more books.`,
        //         isBillingError: true,
        //     };
        // }

        const book = await Book.create({...data, slug, totalSegments: 0});

        return {
            success: true,
            data: serializeData(book),
        }
    } catch (e) {
        console.error('Error creating a book', e);

        return {
            success: false,
            error: e,
        }
    }
}

// export const getBookBySlug = async (slug: string) => {
//     try {
//         await connectToDatabase();

//         const book = await Book.findOne({ slug }).lean();

//         if (!book) {
//             return { success: false, error: 'Book not found' };
//         }

//         return {
//             success: true,
//             data: serializeData(book)
//         }
//     } catch (e) {
//         console.error('Error fetching book by slug', e);
//         return {
//             success: false, error: e
//         }
//     }
// }


// Saves the segmented book content to the database, associating each segment with the corresponding book and clerk. 
// This function is typically called after the PDF has been processed and split into segments, allowing for efficient storage and retrieval of book content during the interactive reading experience.
export const saveBookSegments = async (bookId: string, clerkId: string, segments: TextSegment[]) => {
    try {
        await connectToDatabase();

        console.log('Saving book segments...');

        const segmentsToInsert = segments.map(({ text, segmentIndex, pageNumber, wordCount }) => ({
            clerkId, bookId, content: text, segmentIndex, pageNumber, wordCount
        }));

        await BookSegment.insertMany(segmentsToInsert);

        await Book.findByIdAndUpdate(bookId, { totalSegments: segments.length });

        console.log('Book segments saved successfully.');

        return {
            success: true,
            data: { segmentsCreated: segments.length}
        }
    } catch (e) {
        console.error('Error saving book segments', e);

        await BookSegment.deleteMany({ bookId }); // Remove any inserted segments on failure
        await Book.findByIdAndDelete(bookId); // Delete the book itself to maintain data integrity

        return {
            success: false,
            error: e,
        }
    }
}

// Searches book segments using MongoDB text search with regex fallback
// export const searchBookSegments = async (bookId: string, query: string, limit: number = 5) => {
//     try {
//         await connectToDatabase();

//         console.log(`Searching for: "${query}" in book ${bookId}`);

//         const bookObjectId = new mongoose.Types.ObjectId(bookId);

//         // Try MongoDB text search first (requires text index)
//         let segments: Record<string, unknown>[] = [];
//         try {
//             segments = await BookSegment.find({
//                 bookId: bookObjectId,
//                 $text: { $search: query },
//             })
//                 .select('_id bookId content segmentIndex pageNumber wordCount')
//                 .sort({ score: { $meta: 'textScore' } })
//                 .limit(limit)
//                 .lean();
//         } catch {
//             // Text index may not exist — fall through to regex fallback
//             segments = [];
//         }

//         // Fallback: regex search matching ANY keyword
//         if (segments.length === 0) {
//             const keywords = query.split(/\s+/).filter((k) => k.length > 2);
//             const pattern = keywords.map(escapeRegex).join('|');

//             segments = await BookSegment.find({
//                 bookId: bookObjectId,
//                 content: { $regex: pattern, $options: 'i' },
//             })
//                 .select('_id bookId content segmentIndex pageNumber wordCount')
//                 .sort({ segmentIndex: 1 })
//                 .limit(limit)
//                 .lean();
//         }

//         console.log(`Search complete. Found ${segments.length} results`);

//         return {
//             success: true,
//             data: serializeData(segments),
//         };
//     } catch (error) {
//         console.error('Error searching segments:', error);
//         return {
//             success: false,
//             error: (error as Error).message,
//             data: [],
//         };
//     }
// };