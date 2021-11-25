/* eslint-disable react-native/no-raw-text */
// @flow

import { type EdgeUserInfo } from 'edge-core-js'
import * as React from 'react'
import { Image, Platform, Pressable, ScrollView, TouchableHighlight, TouchableOpacity, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import Share from 'react-native-share'
import Feather from 'react-native-vector-icons/Feather'
import MaterialIcon from 'react-native-vector-icons/MaterialIcons'
import { sprintf } from 'sprintf-js'

import { deleteLocalAccount } from '../../../actions/AccountActions.js'
import { logoutRequest } from '../../../actions/LoginActions.js'
import { selectWalletFromModal } from '../../../actions/WalletActions'
import edgeLogo from '../../../assets/images/edgeLogo/Edge_logo_S.png'
import { Fontello } from '../../../assets/vector'
import { FIO_ADDRESS_LIST, FIO_REQUEST_LIST, SCAN, SETTINGS_OVERVIEW_TAB, TERMS_OF_SERVICE, WALLET_CONNECT } from '../../../constants/SceneKeys'
import { EDGE_URL, getPrivateKeySweepableCurrencies } from '../../../constants/WalletAndCurrencyConstants.js'
import s from '../../../locales/strings'
import { getDisplayDenomination } from '../../../selectors/DenominationSelectors'
import { getSelectedWallet } from '../../../selectors/WalletSelectors'
import { useEffect, useMemo, useState } from '../../../types/reactHooks'
import { useDispatch, useSelector } from '../../../types/reactRedux'
import { type NavigationProp, type ParamList, Actions } from '../../../types/routerTypes.js'
import { getCurrencyIcon } from '../../../util/CurrencyInfoHelpers'
import { SceneWrapper } from '../../common/SceneWrapper.js'
import { ButtonsModal } from '../../modals/ButtonsModal.js'
import { type WalletListResult, WalletListModal } from '../../modals/WalletListModal.js'
import { LOGIN_QR, SWEEP_PRIVATE_KEY } from '../../scenes/ScanScene'
import { Airship } from '../../services/AirshipInstance.js'
import { type Theme, cacheStyles, useTheme } from '../../services/ThemeContext'
import { DividerLine } from '../DividerLine'
import { EdgeText } from '../EdgeText'
import { FiatText } from '../FiatText.js'

type Props = { navigation: NavigationProp<'controlPanel'> }

export function ControlPanel(props: Props) {
  const { navigation } = props
  const state: any = navigation.state
  const { isDrawerOpen } = state
  const dispatch = useDispatch()
  const theme = useTheme()
  const styles = getStyles(theme)

  // ---- Redux State ----

  const activeUsername = useSelector(state => state.core.account.username)
  const context = useSelector(state => state.core.context)
  const selectedCurrencyCode = useSelector(state => state.ui.wallets.selectedCurrencyCode)
  const selectedWalletId = useSelector(state => state.ui.wallets.selectedWalletId)
  const guiWallet = useSelector(state => getSelectedWallet(state))
  const currencyLogo = useSelector(state => (guiWallet != null ? getCurrencyIcon(guiWallet.currencyCode, selectedCurrencyCode).symbolImage : null))
  const { name: currencyDenomName, multiplier: currencyDenomMult } = useSelector(state =>
    guiWallet != null ? getDisplayDenomination(state, selectedCurrencyCode) : { name: '', multiplier: '1' }
  )
  const isoFiatCurrencyCode = guiWallet != null ? guiWallet.isoFiatCurrencyCode : null

  /// ---- Local State ----

  // Maintain the list of usernames:
  const initUsernames = useMemo(() => arrangeUsers(context.localUsers, activeUsername), [context, activeUsername])
  const [usernames, setUsernames] = useState(initUsernames)
  useEffect(() => context.watch('localUsers', localUsers => setUsernames(initUsernames)))

  // User List dropdown/open state:
  const [isDropped, setIsDropped] = useState(false)
  const handleToggleDropdown = () => {
    setIsDropped(!isDropped)
  }
  useEffect(() => {
    if (!isDrawerOpen) setIsDropped(false)
  }, [isDrawerOpen])

  /// ---- Callbacks ----

  const handleDeleteAccount = (username: string) => () => {
    Airship.show(bridge => (
      <ButtonsModal
        bridge={bridge}
        title={s.strings.delete_account_header}
        message={sprintf(s.strings.delete_username_account, username)}
        buttons={{
          ok: {
            label: s.strings.string_delete,
            async onPress() {
              await dispatch(deleteLocalAccount(username))
              return true
            }
          },
          cancel: { label: s.strings.string_cancel }
        }}
      />
    ))
  }

  const handleSwitchAccount = (username: string) => () => {
    dispatch(logoutRequest(username))
  }

  const handleSweep = () => {
    Airship.show(bridge => (
      <WalletListModal bridge={bridge} headerTitle={s.strings.select_wallet} allowedCurrencyCodes={getPrivateKeySweepableCurrencies()} showCreateWallet />
    )).then(({ walletId, currencyCode }: WalletListResult) => {
      if (walletId && currencyCode) {
        dispatch(selectWalletFromModal(selectedWalletId, selectedCurrencyCode))
        Actions.jump(SCAN, {
          data: SWEEP_PRIVATE_KEY
        })
      }
    })
  }

  const handleLoginQr = () => {
    Actions.jump(SCAN, { data: LOGIN_QR })
  }

  const handleShareApp = () => {
    const message = `${sprintf(s.strings.share_subject, s.strings.app_name)}\n\n${s.strings.share_message}\n\n`

    const shareOptions = {
      message: Platform.OS === 'ios' ? message : message + EDGE_URL,
      EDGE_URL: Platform.OS === 'ios' ? EDGE_URL : ''
    }
    Share.open(shareOptions).catch(e => console.log(e))
  }

  const handleGoToScene = (scene: $Keys<ParamList>, sceneProps: any) => {
    const { currentScene, drawerClose } = Actions

    if (currentScene !== scene) {
      navigation.navigate(scene, sceneProps)
    } else if (sceneProps) {
      navigation.setParams(sceneProps)
    }

    drawerClose()
  }

  /// ---- Animation ----

  // Track the destination height of the dropdown
  const userListMaxHeight = styles.rowContainer.height * usernames.length + theme.rem(1)

  // Height value above can change if users are added/removed
  const sMaxHeight = useSharedValue(userListMaxHeight)
  useEffect(() => {
    sMaxHeight.value = withTiming(userListMaxHeight)
  }, [sMaxHeight, userListMaxHeight])

  // Animation completion ratio/multiplier
  // Shared to sync fade & drop animations
  const sAnimationMult = useSharedValue(0)
  useEffect(() => {
    sAnimationMult.value = withTiming(isDropped ? 1 : 0, {
      duration: 500,
      easing: Easing.inOut(Easing.circle)
    })
  }, [sAnimationMult, isDropped])

  /// ---- Dynamic CSS ----

  const aDropdown = useAnimatedStyle(() => ({
    height: sMaxHeight.value * sAnimationMult.value
  }))
  const aFade = useAnimatedStyle(() => ({
    opacity: 0.8 * sAnimationMult.value
  }))
  const aRotate = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${(isDropped ? -180 : 180) * sAnimationMult.value}deg` }]
  }))

  /// ---- Row Data ----

  const rowDatas: any[] = [
    {
      pressHandler: () => handleGoToScene(FIO_ADDRESS_LIST),
      iconName: 'hamburgerButton',
      title: s.strings.drawer_fio_names
    },
    {
      pressHandler: () => handleGoToScene(FIO_REQUEST_LIST),
      iconName: 'hamburgerButton',
      title: s.strings.drawer_fio_requests
    },
    {
      pressHandler: () => handleGoToScene(WALLET_CONNECT),
      iconName: 'hamburgerButton',
      title: s.strings.wc_walletconnect_title
    },
    {
      pressHandler: () => handleLoginQr(),
      iconName: 'hamburgerButton',
      title: s.strings.drawer_scan_qr_send
    },
    { pressHandler: handleSweep, iconName: 'hamburgerButton', title: s.strings.drawer_sweep_private_key },
    {
      pressHandler: () => {
        handleGoToScene(TERMS_OF_SERVICE)
      },
      iconName: 'hamburgerButton',
      title: s.strings.title_terms_of_service
    },
    { pressHandler: handleShareApp, iconName: 'hamburgerButton', title: s.strings.string_share + ' ' + s.strings.app_name },
    {
      pressHandler: () => {
        handleGoToScene(SETTINGS_OVERVIEW_TAB)
      },
      iconName: 'hamburgerButton',
      title: s.strings.settings_title
    },
    {
      pressHandler: () => {
        dispatch(logoutRequest())
      },
      iconName: 'hamburgerButton',
      title: s.strings.settings_button_logout
    }
  ]

  const dividerLine = <DividerLine marginRem={[0.5, -2, 2, 1]} />
  const fiatText =
    isoFiatCurrencyCode === null ? (
      ''
    ) : (
      <FiatText
        nativeCryptoAmount={currencyDenomMult}
        cryptoCurrencyCode={selectedCurrencyCode}
        isoFiatCurrencyCode={isoFiatCurrencyCode}
        autoPrecision
        fiatSymbolSpace
      />
    )

  const exchangeRateText =
    currencyDenomName === null ? (
      <EdgeText style={styles.text}>{s.strings.exchange_rate_loading_singular}</EdgeText>
    ) : (
      <EdgeText style={styles.text}>
        {`1 ${currencyDenomName} = `}
        {fiatText}
      </EdgeText>
    )

  return (
    <SceneWrapper hasHeader={false} hasTabs={false} isGapTop={false} background="none">
      {/* ==== Top Panel Start ==== */}
      <View style={styles.topPanel}>
        <Image style={styles.logoImage} source={edgeLogo} resizeMode="contain" />
        <View style={styles.rowContainer}>
          <View style={styles.rowIconContainer}>{!!currencyLogo && <Image style={styles.icon} source={{ uri: currencyLogo }} />}</View>
          <View style={styles.rowBodyContainer}>{exchangeRateText}</View>
        </View>
        <Pressable onPress={handleToggleDropdown} style={styles.rowContainer}>
          <View style={styles.rowIconContainer}>
            <Fontello name="hamburgerButton" style={styles.icon} size={theme.rem(1.5)} color={theme.controlPanelIcon} />
          </View>
          <View style={styles.rowBodyContainer}>
            <EdgeText style={styles.text}>{activeUsername}</EdgeText>
          </View>
          <View style={styles.rowIconContainer}>
            <Animated.View style={aRotate}>
              <Feather name="chevron-down" color={theme.controlPanelIcon} size={theme.rem(1.5)} />
            </Animated.View>
          </View>
        </Pressable>
        {dividerLine}
      </View>
      {/* ==== Top Panel End ==== */}
      {/* ==== Middle Panel Start ==== */}
      <View style={styles.middlePanel}>
        {/* === Dropdown Start === */}
        <Animated.View style={[styles.dropContainer, aDropdown]}>
          <ScrollView>
            {usernames.map((username: string) => (
              <View key={username} style={styles.rowContainer}>
                <View style={styles.rowIconContainer} />
                <TouchableHighlight style={styles.rowBodyContainer} onPress={handleSwitchAccount(username)}>
                  <EdgeText style={styles.text}>{username}</EdgeText>
                </TouchableHighlight>
                <TouchableHighlight style={styles.rowIconContainer} onPress={handleDeleteAccount(username)}>
                  <MaterialIcon size={theme.rem(1.5)} name="close" color={theme.controlPanelIcon} />
                </TouchableHighlight>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
        {/* === Dropdown End === */}
        <Animated.View style={[styles.disable, styles.invisibleTapper, aFade]} pointerEvents="none" />
        {!isDropped ? null : <Pressable style={styles.invisibleTapper} onPress={handleToggleDropdown} />}
        {/* === Navigation Rows Start === */}
        <View style={styles.rowsContainer}>
          <ScrollView>
            {rowDatas.map(rowData => (
              <TouchableOpacity onPress={rowData.pressHandler} key={rowData.title} style={styles.rowContainer}>
                <View style={styles.rowIconContainer}>
                  <Fontello name={rowData.iconName} style={styles.icon} size={theme.rem(1.5)} color={theme.controlPanelIcon} />
                </View>
                <View style={styles.rowBodyContainer}>
                  <EdgeText style={styles.text}>{rowData.title}</EdgeText>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* === Navigation Rows End === */}
        </View>
      </View>
      {/* ==== Middle Panel End ==== */}
      <View style={styles.bottomPanel}>{dividerLine}</View>
    </SceneWrapper>
  )
}

/**
 * Given a list of users from the core,
 * remove the given user, then organize the 3 most recent users,
 * followed by the rest in alphabetical order.
 */
function arrangeUsers(localUsers: EdgeUserInfo[], activeUsername: string): string[] {
  // Sort the users according to their last login date:
  const usernames = localUsers
    .filter(info => info.username !== activeUsername)
    .sort((a, b) => {
      const { lastLogin: aDate = new Date(0) } = a
      const { lastLogin: bDate = new Date(0) } = b
      return aDate.valueOf() - bDate.valueOf()
    })
    .map(info => info.username)

  // Sort everything after the last 3 entries alphabetically:
  const oldUsernames = usernames.slice(3).sort((a: string, b: string) => {
    const stringA = a.toUpperCase()
    const stringB = b.toUpperCase()
    if (stringA < stringB) return -1
    if (stringA > stringB) return 1
    return 0
  })

  return [...usernames.slice(0, 3), ...oldUsernames]
}

const getStyles = cacheStyles((theme: Theme) => ({
  // Containers/Panels
  topPanel: {
    backgroundColor: theme.modal,
    borderTopLeftRadius: theme.rem(2),
    height: theme.rem(10.5)
  },
  middlePanel: {
    flex: 1,
    flexGrow: 1,
    backgroundColor: theme.modal
  },
  bottomPanel: {
    backgroundColor: theme.modal,
    display: 'flex',
    justifyContent: 'flex-end',
    flexDirection: 'column',
    height: theme.rem(4),
    borderBottomLeftRadius: theme.rem(2)
  },
  rowsContainer: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'flex-start'
  },
  rowContainer: {
    display: 'flex',
    height: theme.rem(2.75),
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center'
  },
  rowIconContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: theme.rem(3),
    aspectRatio: 1,
    marginLeft: theme.rem(0.25)
  },
  rowBodyContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexGrow: 1
  },
  // Animation
  dropContainer: {
    backgroundColor: theme.modal,
    borderBottomLeftRadius: theme.rem(2),
    zIndex: 2,
    position: 'absolute',
    width: '100%'
  },
  disable: {
    backgroundColor: theme.fadeDisable
  },
  // Elements
  logoImage: {
    display: 'flex',
    alignSelf: 'center',
    height: theme.rem(2.25),
    marginTop: theme.rem(2)
  },
  icon: {
    height: theme.rem(1.5),
    width: theme.rem(1.5)
  },
  text: {
    fontFamily: theme.fontFaceMedium,
    marginLeft: theme.rem(0.5)
  },
  invisibleTapper: {
    position: 'absolute',
    height: '100%',
    width: '100%',
    borderBottomLeftRadius: theme.rem(2),
    zIndex: 1
  }
}))
