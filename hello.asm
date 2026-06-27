.MODEL SMALL
.STACK 100H

.DATA
    MSG DB 'How are you doing$'

.CODE
MAIN PROC
    ; Initialize data segment
    MOV AX, @DATA
    MOV DS, AX

    ; Display the stringS
    LEA DX, MSG
    MOV AH, 09H
    INT 21H

    ; Return control to DOS (Exit)
    MOV AH, 4CH
    INT 21H
MAIN ENDP
END MAIN