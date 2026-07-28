fn main() {
    #[cfg(target_os = "macos")]
    {
        cc::Build::new()
            .file("src/mac_ocr.m")
            .flag("-fobjc-arc")
            .compile("mac_ocr");
        println!("cargo:rustc-link-lib=framework=Vision");
        println!("cargo:rustc-link-lib=framework=PDFKit");
        println!("cargo:rustc-link-lib=framework=Cocoa");
        println!("cargo:rustc-link-lib=framework=CoreGraphics");
        println!("cargo:rustc-link-lib=framework=AppKit");
    }
    tauri_build::build();
}
