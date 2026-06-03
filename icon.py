#!/usr/bin/env python3
"""
Icon Generator for RenASM (Renance Playground)
Windows Version - Auto-generates all icon sizes
Author: Resolute Femi

Usage:
    1. Place ice.jpg in same folder as this script
    2. Run: python icon_gen.py
    3. All icons generated automatically!
"""

from PIL import Image
import os
from pathlib import Path
import sys

# Reconfigure stdout and stderr to support UTF-8 (emojis) on Windows
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

def create_icons(source_image_path, base_icons_dir="src-tauri/icons"):
    """Generate all required icon sizes for all platforms"""
    
    print("=" * 60)
    print("🎨 RenASM Icon Generator")
    print("=" * 60)
    
    # Check if source image exists
    if not os.path.exists(source_image_path):
        print(f"❌ Error: Image not found: {source_image_path}")
        print(f"   Current directory: {os.getcwd()}")
        print(f"   Please place ice.jpg in this folder")
        return False
    
    # Open source image
    try:
        img = Image.open(source_image_path)
        print(f"\n✅ Loaded image: {source_image_path}")
        print(f"   Size: {img.size[0]}x{img.size[1]}")
    except Exception as e:
        print(f"❌ Error loading image: {e}")
        return False
    
    # Ensure it's RGBA (supports transparency)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
        print(f"   Converted to RGBA")
    
    # Create base icons directory
    Path(base_icons_dir).mkdir(parents=True, exist_ok=True)
    print(f"\n📁 Icons directory: {base_icons_dir}")
    
    # ========== DESKTOP ICONS ==========
    print("\n" + "=" * 60)
    print("🖥️  DESKTOP ICONS (Windows/macOS/Linux)")
    print("=" * 60)
    
    desktop_icons = {
        'icon.png': (512, 512, 'PNG', 'Primary icon'),
        'icon.ico': (256, 256, 'ICO', 'Windows executable'),
        'icon.icns': (1024, 1024, 'ICNS', 'macOS application icon'),
        '32x32.png': (32, 32, 'PNG', 'Tauri small icon'),
        '128x128.png': (128, 128, 'PNG', 'Tauri medium icon'),
        '128x128@2x.png': (256, 256, 'PNG', 'Tauri retina icon'),
    }
    
    for name, (width, height, fmt, description) in desktop_icons.items():
        resized = img.resize((width, height), Image.Resampling.LANCZOS)
        output_path = os.path.join(base_icons_dir, name)
        
        try:
            resized.save(output_path, fmt)
            print(f"✅ {name:20} → {width}x{height} ({description})")
        except Exception as e:
            print(f"❌ Error saving {name}: {e}")
    
    # ========== ANDROID ICONS ==========
    print("\n" + "=" * 60)
    print("📱 ANDROID ICONS (Multiple Screen Densities)")
    print("=" * 60)
    
    android_base = "src-tauri/gen/android/app/src/main/res"
    
    android_sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }
    
    for density, size in android_sizes.items():
        # Create directory
        android_dir = os.path.join(android_base, density)
        Path(android_dir).mkdir(parents=True, exist_ok=True)
        
        # Resize for this density
        android_icon = img.resize((size, size), Image.Resampling.LANCZOS)
        
        # Save regular icon
        output_path = os.path.join(android_dir, "ic_launcher.png")
        try:
            android_icon.save(output_path, 'PNG')
            print(f"✅ {density:20} → ic_launcher.png ({size}x{size})")
        except Exception as e:
            print(f"❌ Error saving {density}/ic_launcher.png: {e}")
        
        # Save round icon variant
        round_path = os.path.join(android_dir, "ic_launcher_round.png")
        try:
            android_icon.save(round_path, 'PNG')
            print(f"   └─ ic_launcher_round.png ({size}x{size})")
        except Exception as e:
            print(f"❌ Error saving {density}/ic_launcher_round.png: {e}")
    
    # ========== WEB ICON ==========
    print("\n" + "=" * 60)
    print("🌐 WEB ICON (Browser/PWA)")
    print("=" * 60)
    
    web_dir = "public"
    Path(web_dir).mkdir(parents=True, exist_ok=True)
    
    web_icon = img.resize((512, 512), Image.Resampling.LANCZOS)
    web_path = os.path.join(web_dir, "icon.jpg")
    
    try:
        # Convert RGBA to RGB for JPEG formatting
        rgb_web_icon = web_icon.convert('RGB')
        rgb_web_icon.save(web_path, 'JPEG', quality=95)
        print(f"✅ public/icon.jpg → 512x512 (Web/PWA)")
    except Exception as e:
        print(f"❌ Error saving web icon: {e}")
    
    # ========== SUMMARY ==========
    print("\n" + "=" * 60)
    print("✨ SUCCESS! All icons generated!")
    print("=" * 60)
    
    print("\n📂 Desktop Icons (src-tauri/icons/):")
    print("   ├─ icon.png (512x512)")
    print("   ├─ icon.ico (256x256)")
    print("   ├─ icon.icns (1024x1024 / Multi-size)")
    print("   ├─ 32x32.png (32x32)")
    print("   ├─ 128x128.png (128x128)")
    print("   └─ 128x128@2x.png (256x256)")
    
    print("\n📱 Android Icons (src-tauri/gen/android/.../):")
    print("   ├─ mipmap-mdpi/ (48x48)")
    print("   ├─ mipmap-hdpi/ (72x72)")
    print("   ├─ mipmap-xhdpi/ (96x96)")
    print("   ├─ mipmap-xxhdpi/ (144x144)")
    print("   └─ mipmap-xxxhdpi/ (192x192)")
    
    print("\n🌐 Web Icon (public/):")
    print("   └─ icon.jpg (512x512)")
    
    print("\n" + "=" * 60)
    print("🚀 Next Steps:")
    print("=" * 60)
    print("1. ✅ Icons generated")
    print("2. Copy Android config files:")
    print("   - AndroidManifest.xml")
    print("   - network_security_config.xml")
    print("   - file_paths.xml")
    print("   - strings.xml")
    print("3. Update tauri.conf.json with app name")
    print("4. Build: npm run tauri:build")
    print("=" * 60)
    
    return True

if __name__ == '__main__':
    """Main entry point"""
    
    print("\n🎨 RenASM Icon Generator Started\n")
    
    # Default paths to try
    possible_paths = [
        'ice.jpg',
        'public/icon.jpg',
        '../ice.jpg',
        '../../ice.jpg',
    ]
    
    image_path = None
    
    # Try to find image
    for path in possible_paths:
        if os.path.exists(path):
            image_path = path
            break
    
    # If not found, ask user
    if not image_path:
        print("❓ No image found automatically")
        user_path = input("Enter path to your icon image (e.g., ice.jpg): ").strip()
        if os.path.exists(user_path):
            image_path = user_path
        else:
            print(f"❌ File not found: {user_path}")
            print(f"   Current directory: {os.getcwd()}")
            sys.exit(1)
    
    # Generate all icons
    success = create_icons(image_path)
    
    if success:
        print("\n✅ Done! All icons ready for building.")
        input("\nPress Enter to exit...")
    else:
        print("\n❌ Icon generation failed")
        sys.exit(1)