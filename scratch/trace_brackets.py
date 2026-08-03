def trace_brackets(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    # Step 5 lines
    start_line = 2705 # Start right at step === 5 && (
    end_line = 4440
    
    stack = []
    
    for idx in range(start_line, end_line):
        if idx >= len(lines):
            break
        line = lines[idx]
        line_num = idx + 1
        
        # Track brackets
        for char_idx, char in enumerate(line):
            if char in '{(':
                stack.append((char, line_num, char_idx + 1))
                print(f"Push '{char}' at {line_num}:{char_idx+1}. Stack size: {len(stack)}")
            elif char in '})':
                if stack:
                    top_char, top_line, top_col = stack[-1]
                    match = False
                    if char == '}' and top_char == '{':
                        match = True
                    elif char == ')' and top_char == '(':
                        match = True
                        
                    if match:
                        stack.pop()
                        print(f"Pop '{char}' at {line_num}:{char_idx+1} matching '{top_char}' from {top_line}:{top_col}. Stack size: {len(stack)}")
                    else:
                        print(f"Mismatch: '{char}' at {line_num}:{char_idx+1} doesn't match '{top_char}' from {top_line}:{top_col}")
                else:
                    print(f"Unmatched closing '{char}' at {line_num}:{char_idx+1}")

    print("\nFinal stack:")
    for item in stack:
        print(item)

if __name__ == '__main__':
    trace_brackets('/Volumes/1TB/WebProjects/VideoGenerator/src/components/YoutubeCreator.tsx')
