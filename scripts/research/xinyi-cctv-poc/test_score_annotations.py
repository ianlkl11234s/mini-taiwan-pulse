"""Synthetic checks for score_annotations.score (no model needed).

Run: ../../../.venv-cctv/bin/python3 -m unittest test_score_annotations  (also covers score_boxes)
"""
import unittest

from score_annotations import score


def box(cx, bottom, tid, cls="car", w=.1, h=.1):
    return [cx - w / 2, bottom - h, cx + w / 2, bottom, tid, cls]


class ScoreTest(unittest.TestCase):
    def setUp(self):
        self.frames = [{"t": t, "duplicateOfPrevious": t == 2} for t in (0, 1, 2, 3, 4)]
        self.annotation = {"window": {"start": 0, "end": 4}, "allVisibleVehiclesAnnotated": True, "vehicles": [
            {"id": "V1", "className": "car", "keyframes": [
                {"t": t, "x": .2 + .1 * t, "y": .5, "visibility": "visible"} for t in (0, 1, 2, 3, 4)]},
            {"id": "V2", "className": "motorcycle", "keyframes": [
                {"t": 0, "x": .8, "y": .8, "visibility": "visible"},
                {"t": 1, "x": .8, "y": .8, "visibility": "occluded"}]},
        ]}

    def test_switch_miss_duplicate_and_unexplained(self):
        boxes = [
            [box(.2, .5, "a"), box(.5, .2, "ghost")],
            [box(.3, .5, "a"), box(.5, .2, "ghost")],
            [box(.4, .5, "a")],
            [box(.5, .5, "b", cls="truck"), box(.5, .2, "ghost")],
            [],
        ]
        r = score(self.annotation, self.frames, boxes)
        # V1: t0,t1,t3,t4 scored (t2 duplicate); V2: t0 scored, t1 occluded skipped
        self.assertEqual(r["visibleKeyframes"], 5)
        self.assertEqual(r["keyframeHitRate"], .6)
        self.assertEqual(r["keyframeHitRateByClass"], {"car": .75, "motorcycle": 0.0})
        self.assertEqual(r["idSwitches"], 1)
        self.assertEqual(r["classDisagreements"], 1)
        self.assertEqual(r["skippedKeyframes"], {"duplicateFrame": 1, "visibility:occluded": 1})
        self.assertEqual(r["unexplainedTrackerIds"], 1)

    def test_one_box_cannot_serve_two_vehicles(self):
        self.annotation["vehicles"][1]["keyframes"][0].update(x=.21, y=.5)
        r = score(self.annotation, self.frames, [[box(.2, .5, "a")], [], [], [], []])
        self.assertEqual(r["trackerIdsSharedByVehicles"], 0)
        self.assertEqual(r["vehiclesEverTracked"], 1)

    def test_unexplained_needs_completeness_claim(self):
        self.annotation["allVisibleVehiclesAnnotated"] = False
        self.assertIsNone(score(self.annotation, self.frames, [[]] * 5)["unexplainedTrackerIds"])


if __name__ == "__main__":
    unittest.main()


class BoxScoreTest(unittest.TestCase):
    def test_recall_precision_and_confusion(self):
        from score_boxes import score as box_score
        review = {"frames": [
            {"frameIndex": 0, "reviewed": True, "boxes": [
                {"bbox": [0, 0, .1, .1], "className": "motorcycle"},
                {"bbox": [.5, .5, .6, .6], "className": "car"}]},
            {"frameIndex": 1, "reviewed": False, "boxes": [{"bbox": [0, 0, .1, .1], "className": "car"}]},
        ]}
        per_frame = [[[0, 0, .1, .1, "t1", "truck"], [.8, .8, .9, .9, "t2", "car"]], []]
        r = box_score(review, per_frame)
        self.assertEqual((r["scoredFrames"], r["recall"], r["precision"], r["missed"], r["extra"]), (1, .5, .5, 1, 1))
        self.assertEqual(r["classConfusion"], {"motorcycle->truck": 1})
        self.assertEqual(r["byClass"]["motorcycle"]["classCorrectWhenMatched"], 0.0)
