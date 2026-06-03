; Simple Calculator Simulation
; Set inputs in AL and BL, operator in CL:
; CL = 1 (Add), CL = 2 (Subtract), CL = 3 (XOR)
MOV AL, 15         ; Input 1
MOV BL, 7          ; Input 2
MOV CL, 1          ; Operator (1 = Add)

CMP CL, 1
JE DO_ADD
CMP CL, 2
JE DO_SUB
CMP CL, 3
JE DO_XOR
JMP CALC_DONE

DO_ADD:
    ADD AL, BL     ; Result in AL
    JMP CALC_DONE

DO_SUB:
    SUB AL, BL     ; Result in AL
    JMP CALC_DONE

DO_XOR:
    XOR AL, BL     ; Result in AL

CALC_DONE:
    HLT