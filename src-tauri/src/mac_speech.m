#import <Foundation/Foundation.h>
#import <Speech/Speech.h>
#import <AVFoundation/AVFoundation.h>

/**
 * macOS native speech-to-text using SFSpeechRecognizer.
 * Transcribes an audio file (WAV/M4A/CAF/MP4) to text.
 * Returns a malloc'd UTF-8 C string, caller must free via macos_speech_free_string().
 * On error, returns a string prefixed with "ERROR:" describing the issue.
 */
char* macos_transcribe_audio(const char* c_path) {
    if (!c_path) return strdup("ERROR:null_path");
    @autoreleasepool {
        NSString *path = [NSString stringWithUTF8String:c_path];
        NSURL *url = [NSURL fileURLWithPath:path];
        
        // Check file exists
        if (![[NSFileManager defaultManager] fileExistsAtPath:path]) {
            NSLog(@"[Speech] File not found: %@", path);
            return strdup("ERROR:file_not_found");
        }
        
        // Log file info for debugging
        NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:path error:nil];
        NSLog(@"[Speech] File: %@, size: %@ bytes", path, attrs[NSFileSize]);
        
        // Check speech recognition authorization
        SFSpeechRecognizerAuthorizationStatus authStatus = [SFSpeechRecognizer authorizationStatus];
        NSLog(@"[Speech] Auth status: %ld", (long)authStatus);
        
        if (authStatus == SFSpeechRecognizerAuthorizationStatusNotDetermined) {
            // Request authorization synchronously
            __block SFSpeechRecognizerAuthorizationStatus newStatus = authStatus;
            dispatch_semaphore_t authSem = dispatch_semaphore_create(0);
            [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
                newStatus = status;
                dispatch_semaphore_signal(authSem);
            }];
            dispatch_semaphore_wait(authSem, dispatch_time(DISPATCH_TIME_NOW, (int64_t)(30 * NSEC_PER_SEC)));
            authStatus = newStatus;
            NSLog(@"[Speech] Auth status after request: %ld", (long)authStatus);
        }
        
        if (authStatus == SFSpeechRecognizerAuthorizationStatusDenied) {
            return strdup("ERROR:speech_auth_denied");
        }
        if (authStatus == SFSpeechRecognizerAuthorizationStatusRestricted) {
            return strdup("ERROR:speech_auth_restricted");
        }
        
        // Create speech recognizer for Chinese (primary) with English fallback
        SFSpeechRecognizer *recognizer = [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:@"zh-CN"]];
        if (!recognizer || !recognizer.isAvailable) {
            NSLog(@"[Speech] zh-CN recognizer not available, trying en-US");
            recognizer = [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:@"en-US"]];
            if (!recognizer || !recognizer.isAvailable) {
                NSLog(@"[Speech] No speech recognizer available");
                return strdup("ERROR:recognizer_unavailable");
            }
        }
        NSLog(@"[Speech] Using recognizer locale: %@", recognizer.locale.localeIdentifier);
        
        // Create recognition request from audio file
        SFSpeechURLRecognitionRequest *request = [[SFSpeechURLRecognitionRequest alloc] initWithURL:url];
        request.shouldReportPartialResults = NO;
        
        // Prefer on-device recognition (faster, no network needed)
        if (@available(macOS 13.0, *)) {
            if (recognizer.supportsOnDeviceRecognition) {
                request.requiresOnDeviceRecognition = YES;
                NSLog(@"[Speech] Using on-device recognition");
            } else {
                request.requiresOnDeviceRecognition = NO;
                NSLog(@"[Speech] On-device not supported, using server");
            }
        }
        
        // Synchronous wrapper using semaphore
        __block NSString *resultText = nil;
        __block NSError *resultError = nil;
        dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
        
        SFSpeechRecognitionTask *task = [recognizer recognitionTaskWithRequest:request
                                 resultHandler:^(SFSpeechRecognitionResult * _Nullable result, NSError * _Nullable error) {
            if (error) {
                resultError = error;
                NSLog(@"[Speech] Recognition error: %@ (code: %ld)", error.localizedDescription, (long)error.code);
                dispatch_semaphore_signal(semaphore);
                return;
            }
            if (result.isFinal) {
                resultText = result.bestTranscription.formattedString;
                NSLog(@"[Speech] Recognition result: %@", resultText);
                dispatch_semaphore_signal(semaphore);
            }
        }];
        
        if (!task) {
            NSLog(@"[Speech] Failed to create recognition task");
            return strdup("ERROR:task_creation_failed");
        }
        
        // Wait up to 60 seconds for transcription
        dispatch_time_t timeout = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(60 * NSEC_PER_SEC));
        long waitResult = dispatch_semaphore_wait(semaphore, timeout);
        
        if (waitResult != 0) {
            NSLog(@"[Speech] Recognition timed out after 60s");
            [task cancel];
            return strdup("ERROR:timeout");
        }
        
        if (resultError) {
            NSString *errMsg = [NSString stringWithFormat:@"ERROR:recognition_error:%ld:%@",
                               (long)resultError.code, resultError.localizedDescription];
            return strdup([errMsg UTF8String]);
        }
        
        if (resultText && [resultText length] > 0) {
            const char *utf8 = [resultText UTF8String];
            return strdup(utf8);
        }
        
        NSLog(@"[Speech] No transcription result");
        return strdup("ERROR:empty_result");
    }
}

void macos_speech_free_string(char* ptr) {
    if (ptr) free(ptr);
}
