fn main() {
    #[cfg(target_os = "macos")]
    {
        // OCR module (Apple Vision)
        cc::Build::new()
            .file("src/mac_ocr.m")
            .flag("-fobjc-arc")
            .compile("mac_ocr");

        // Speech recognition module (SFSpeechRecognizer)
        cc::Build::new()
            .file("src/mac_speech.m")
            .flag("-fobjc-arc")
            .compile("mac_speech");

        println!("cargo:rustc-link-lib=framework=Vision");
        println!("cargo:rustc-link-lib=framework=PDFKit");
        println!("cargo:rustc-link-lib=framework=Cocoa");
        println!("cargo:rustc-link-lib=framework=CoreGraphics");
        println!("cargo:rustc-link-lib=framework=AppKit");
        println!("cargo:rustc-link-lib=framework=Speech");
        println!("cargo:rustc-link-lib=framework=AVFoundation");
    }
    tauri_build::build();
}
