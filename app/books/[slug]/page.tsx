import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { ArrowLeft, Mic, MicOff } from 'lucide-react';
import { getBookBySlug } from '@/lib/actions/book.actions';
import VapiControls from '@/components/VapiControls';

// type BookPageParams = {
//   slug: string;
// };

// const Page = async ({ params }: { params: Promise<BookPageParams> }) => {
//   const { userId } = await auth();
//   if (!userId) {
//     redirect('/');
//   }

//   const { slug } = await params;
//   const bookResult = await getBookBySlug(slug);
//   if (!bookResult.success || !bookResult.data) {
//     redirect('/');
//   }

//   const { title, author, coverURL, persona } = bookResult.data as {
//     title: string;
//     author: string;
//     coverURL: string;
//     persona?: string;
//   };

//   const book = result.data;

//   return (
//     <div className="book-page-container">
//       <Link href="/" className="back-btn-floating">
//         <ArrowLeft className="size-6 text-[#212a3b]" />
//       </Link>

//         <VapiControls book={book} />
      
//     </div>
//   );
// };

// export default Page;



export default async function BookDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const { slug } = await params;
  const result = await getBookBySlug(slug);

  if (!result.success || !result.data) {
    redirect("/");
  }

  const book = result.data;

  return (
    <div className="book-page-container">
      <Link href="/" className="back-btn-floating">
        <ArrowLeft className="size-6 text-[#212a3b]" />
      </Link>

      <VapiControls book={book} />
    </div>
  );
}