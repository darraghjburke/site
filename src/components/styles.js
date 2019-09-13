import styled from "@emotion/styled"

export const Colors = {
    "accent": "#6BC0E8"
}

export const LinkA = styled.a`
    color: black;
    text-decoration: none;
    font-weight: bold;
    &:hover{
        background-color: ${Colors.accent};
        color: white;
    }
`;