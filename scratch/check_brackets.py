import re

def check_jsx_tags(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    # Let's find step === 5 start and step === 6 start
    start_line = None
    end_line = None
    for i, line in enumerate(lines):
        if 'step === 5 && (' in line:
            start_line = i
        if 'step === 6 && (' in line:
            end_line = i
            break

    if start_line is None or end_line is None:
        print("Could not find step 5 or 6")
        return

    print(f"Checking JSX tags from line {start_line+1} to {end_line+1}")
    
    # Regex to find JSX tags: opening/closing/self-closing
    # e.g., <div ...>, </div>, <input ... />
    # Let's do a simplified tag extractor
    tag_pattern = re.compile(r'<(/?[a-zA-Z0-9\-:]+)([^>]*?)(/?)>')
    
    tag_stack = []
    bracket_stack = []
    
    for idx in range(start_line, end_line + 20):
        if idx >= len(lines):
            break
        line = lines[idx]
        line_num = idx + 1
        
        # Track brackets first
        for char_idx, char in enumerate(line):
            if char in '{(':
                bracket_stack.append((char, line_num, char_idx + 1))
            elif char in '})':
                if bracket_stack:
                    top_char, top_line, top_col = bracket_stack[-1]
                    if (char == '}' and top_char == '{') or (char == ')' and top_char == '('):
                        bracket_stack.pop()
                    else:
                        print(f"Brace mismatch: '{char}' at line {line_num}:{char_idx+1} doesn't match '{top_char}' from line {top_line}:{top_col}")
                else:
                    print(f"Unmatched closing '{char}' at line {line_num}:{char_idx+1}")

        # Track JSX tags (simplified - may match inside strings, but let's see)
        # To avoid comments/strings, we just do a simple check
        for match in tag_pattern.finditer(line):
            tag_name = match.group(1)
            is_closing = tag_name.startswith('/')
            is_self_closing = match.group(3) == '/' or tag_name in ['input', 'img', 'br', 'hr', 'link', 'meta']
            
            if is_closing:
                clean_name = tag_name[1:]
                if not tag_stack:
                    print(f"Unmatched closing tag: <{tag_name}> at line {line_num}")
                else:
                    top_tag, top_line = tag_stack.pop()
                    if top_tag != clean_name:
                        print(f"Tag mismatch: <{tag_name}> at line {line_num} does not match <{top_tag}> from line {top_line}")
            elif not is_self_closing:
                tag_stack.append((tag_name, line_num))
                
    print("\n--- Remaining Brackets Stack ---")
    for item in bracket_stack:
        print(item)
        
    print("\n--- Remaining Tags Stack ---")
    for item in tag_stack:
        print(item)

if __name__ == '__main__':
    check_jsx_tags('/Volumes/1TB/WebProjects/VideoGenerator/src/components/YoutubeCreator.tsx')
