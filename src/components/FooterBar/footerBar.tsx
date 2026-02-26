import { useAppColors } from "../../theme/context"

export const FooterBar = () => {
	const colors = useAppColors()
	return (
		<box
			backgroundColor={colors.background}
			width={"100%"}
			flexDirection="row"
			justifyContent="space-between"
			paddingLeft={1}
			paddingRight={1}
		>
			<text fg={colors.textMuted}>Press F1 to open shortcuts</text>
		</box>
	)
}
