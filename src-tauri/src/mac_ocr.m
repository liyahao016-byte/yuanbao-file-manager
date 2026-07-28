#import <Foundation/Foundation.h>
#import <Vision/Vision.h>
#import <PDFKit/PDFKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <AppKit/AppKit.h>

char* macos_ocr_pdf_or_image(const char* c_path) {
    if (!c_path) return NULL;
    @autoreleasepool {
        NSString *path = [NSString stringWithUTF8String:c_path];
        NSURL *url = [NSURL fileURLWithPath:path];
        
        CGImageRef cgImage = NULL;
        
        // 1. Try loading as PDF page 0
        PDFDocument *doc = [[PDFDocument alloc] initWithURL:url];
        if (doc && [doc pageCount] > 0) {
            PDFPage *page = [doc pageAtIndex:0];
            CGRect rect = [page boundsForBox:kPDFDisplayBoxMediaBox];
            int width = (int)rect.size.width;
            int height = (int)rect.size.height;
            if (width > 0 && height > 0) {
                CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
                CGContextRef context = CGBitmapContextCreate(NULL, width, height, 8, 0, colorSpace, kCGImageAlphaPremultipliedLast);
                CGColorSpaceRelease(colorSpace);
                if (context) {
                    CGContextSetRGBFillColor(context, 1.0, 1.0, 1.0, 1.0);
                    CGContextFillRect(context, CGRectMake(0, 0, width, height));
                    [page drawWithBox:kPDFDisplayBoxMediaBox toContext:context];
                    cgImage = CGBitmapContextCreateImage(context);
                    CGContextRelease(context);
                }
            }
        }
        
        // 2. If not PDF, try loading as NSImage
        if (!cgImage) {
            NSImage *nsImage = [[NSImage alloc] initWithContentsOfURL:url];
            if (nsImage) {
                cgImage = [nsImage CGImageForProposedRect:NULL context:NULL hints:NULL];
                if (cgImage) CGImageRetain(cgImage);
            }
        }
        
        if (!cgImage) return NULL;
        
        // 3. Perform VNRecognizeTextRequest using Apple Vision
        VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] init];
        [request setRecognitionLanguages:@[@"zh-Hans", @"zh-Hant", @"en-US"]];
        [request setUsesLanguageCorrection:YES];
        
        VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:cgImage options:@{}];
        NSError *error = nil;
        [handler performRequests:@[request] error:&error];
        CGImageRelease(cgImage);
        
        if (error || ![request results]) {
            return NULL;
        }
        
        NSMutableString *resultText = [NSMutableString string];
        for (VNRecognizedTextObservation *observation in [request results]) {
            VNRecognizedText *topCandidate = [[observation topCandidates:1] firstObject];
            if (topCandidate) {
                [resultText appendString:[topCandidate string]];
                [resultText appendString:@"\n"];
            }
        }
        
        if ([resultText length] == 0) return NULL;
        
        const char *utf8 = [resultText UTF8String];
        return strdup(utf8);
    }
}

void macos_ocr_free_string(char* ptr) {
    if (ptr) free(ptr);
}
