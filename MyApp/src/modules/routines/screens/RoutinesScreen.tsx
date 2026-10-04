import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../../../components/Screen';
import { LargeTitle } from '../../../components/ScreenHeader';
import { Fab } from '../../../components/Controls';
import { EmptyState, ErrorState, FadeIn, SkeletonList } from '../../../components/Feedback';
import { getErrorMessage } from '../../../utils/apiError';
import { useListTracksQuery } from '../routinesApi';
import { CategoryCard } from '../components';
import type { RootStackParamList } from '../../../navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The Categories tab: every category, with today's progress. */
export function RoutinesScreen() {
  const navigation = useNavigation<Nav>();
  const tracks = useListTracksQuery();
  const newCategory = () => navigation.navigate('TrackEditor');

  return (
    <Screen
      onRefresh={tracks.refetch}
      refreshing={tracks.isFetching}
      footer={tracks.data?.length ? <Fab accessibilityLabel="New category" onPress={newCategory} /> : null}
    >
      <LargeTitle title="Categories" />
      {tracks.isLoading ? (
        <SkeletonList count={3} height={76} />
      ) : tracks.isError ? (
        <ErrorState message={getErrorMessage(tracks.error, 'Could not load your categories.')} onRetry={tracks.refetch} />
      ) : !tracks.data?.length ? (
        <EmptyState
          icon="target"
          title="No categories yet"
          message="A category is a goal like Gym or Study. Add tasks to it and tick them off every day."
          actionLabel="New category"
          onAction={newCategory}
        />
      ) : (
        tracks.data.map((track, i) => (
          <FadeIn key={track.id} index={i}>
            <CategoryCard track={track} onPress={() => navigation.navigate('TrackDetail', { trackId: track.id })} />
          </FadeIn>
        ))
      )}
    </Screen>
  );
}
