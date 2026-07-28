use objc::{class, msg_send, sel, sel_impl};
use cocoa::base::{id, nil};
use cocoa::foundation::NSString;
use std::slice;

fn get_icon_base64(path: &str) -> Option<String> {
    unsafe {
        let workspace: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        let path_str = NSString::alloc(nil).init_str(path);
        let image: id = msg_send![workspace, iconForFile: path_str];
        
        if image == nil {
            return None;
        }

        let cg_ref: id = msg_send![image, CGImageForProposedRect: std::ptr::null_mut::<std::ffi::c_void>() context: nil hints: nil];
        let bitmap_rep: id = msg_send![class!(NSBitmapImageRep), alloc];
        let bitmap_rep: id = msg_send![bitmap_rep, initWithCGImage: cg_ref];
        let props: id = msg_send![class!(NSDictionary), dictionary];
        let png_data: id = msg_send![bitmap_rep, representationUsingType: 4 properties: props];
        
        if png_data == nil {
            return None;
        }

        let bytes: *const u8 = msg_send![png_data, bytes];
        let length: usize = msg_send![png_data, length];
        let slice = slice::from_raw_parts(bytes, length);
        
        use base64::{Engine as _, engine::general_purpose};
        Some(general_purpose::STANDARD.encode(slice))
    }
}

fn main() {
    println!("Base64 Length: {:?}", get_icon_base64("/Applications/Safari.app").map(|s| s.len()));
}
