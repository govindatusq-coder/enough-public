import {Suspense} from 'react';
import {CaptureSheet} from '@/components/bear/capture-sheet';
// The other ways to give something to Bear: a photo, a screenshot, a PDF, a long paste, or something shared from another app.
export default function CaptureMorePage(){return <Suspense fallback={null}><CaptureSheet/></Suspense>;}
